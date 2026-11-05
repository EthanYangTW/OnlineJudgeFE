<template>
  <div class="fcu-c-editor">
    <codemirror :value="value" :options="options" @change="onChange" ref="source"></codemirror>
    <div v-if="diagnostics.length" class="diagnostics">
      <div v-for="(item, index) in diagnostics" :key="index" class="diagnostic"
           :class="item.severity === 'warning' ? 'warning' : item.severity === 'note' ? 'note' : 'error'" @click="jumpTo(item)">
        <Icon :type="item.severity === 'warning' ? 'android-alert' : item.severity === 'note' ? 'information-circled' : 'close-circled'"></Icon>
        <span v-if="item.line">{{ item.line }}<span v-if="item.column">:{{ item.column }}</span> · </span>{{ item.message }}
      </div>
    </div>
  </div>
</template>

<script>
  import CodeMirror from 'codemirror'
  import {codemirror} from 'vue-codemirror-lite'
  import 'codemirror/mode/clike/clike.js'
  import 'codemirror/addon/selection/active-line.js'
  import 'codemirror/addon/hint/show-hint.js'
  import 'codemirror/addon/hint/show-hint.css'
  import 'codemirror/addon/edit/closebrackets.js'
  import 'codemirror/addon/edit/matchbrackets.js'
  import 'codemirror/theme/material-darker.css'

  // Language help only: no task-specific answers, test data, or generated solutions.
  const completions = [
    '#include', '#define', 'auto', 'break', 'case', 'char', 'const', 'continue',
    'default', 'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto',
    'if', 'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof',
    'static', 'struct', 'switch', 'typedef', 'union', 'unsigned', 'void',
    'volatile', 'while', 'NULL', 'EOF', 'stdin', 'stdout', 'stderr',
    'stdio.h', 'stdlib.h', 'string.h', 'math.h', 'ctype.h', 'stdbool.h',
    'limits.h', 'stdint.h', 'printf', 'scanf', 'fprintf', 'fgets', 'puts',
    'putchar', 'getchar', 'sscanf', 'snprintf', 'strlen', 'strcmp', 'strcpy',
    'malloc', 'calloc', 'realloc', 'free', 'exit', 'abs', 'sqrt', 'pow'
  ]

  function completeC (cm) {
    const cursor = cm.getCursor()
    const line = cm.getLine(cursor.line)
    const before = line.slice(0, cursor.ch)
    const match = before.match(/[A-Za-z_#][A-Za-z0-9_.#]*$/)
    const typed = match ? match[0] : ''
    const from = CodeMirror.Pos(cursor.line, cursor.ch - typed.length)
    const list = completions.filter(item => item.toLowerCase().indexOf(typed.toLowerCase()) === 0)
    return {list, from, to: cursor}
  }

  // Keep completion entirely local so it appears on the first typed character.
  // CodeMirror installs this Tab binding only while the suggestion menu is open.
  const hintOptions = {
    hint: completeC,
    completeSingle: false,
    extraKeys: {Tab: (editor, menu) => { menu.pick(); editor.focus() }}
  }

  export default {
    name: 'FcuCEditor',
    components: {codemirror},
    props: {
      value: {type: String, default: ''},
      disabled: {type: Boolean, default: false},
      diagnostics: {type: Array, default: () => []},
      theme: {type: String, default: 'dark'}
    },
    data () {
      return {
        options: {
          mode: 'text/x-csrc',
          theme: this.theme === 'dark' ? 'material-darker' : 'default',
          lineNumbers: true,
          styleActiveLine: true,
          matchBrackets: true,
          autoCloseBrackets: true,
          indentUnit: 4,
          tabSize: 4,
          indentWithTabs: false,
          lineWrapping: false,
          readOnly: this.disabled,
          hintOptions,
          gutters: ['CodeMirror-linenumbers', 'fcu-errors'],
          extraKeys: {
            'Ctrl-Space': cm => cm.showHint(),
            'Cmd-Space': cm => cm.showHint()
          }
        }
      }
    },
    mounted () {
      this.drawDiagnostics()
      this.$nextTick(() => this.editor.refresh())
      this.editor.on('inputRead', (cm, change) => {
        if (this.disabled || !change.text || change.text.length !== 1 ||
            !/^[A-Za-z_#]$/.test(change.text[0]) || cm.state.completionActive) return
        const token = cm.getTokenAt(cm.getCursor())
        if (token.type === 'comment' || token.type === 'string') return
        if (completeC(cm).list.length) cm.showHint()
      })
    },
    watch: {
      disabled (value) { this.editor.setOption('readOnly', value) },
      theme (value) { this.editor.setOption('theme', value === 'dark' ? 'material-darker' : 'default') },
      diagnostics () { this.$nextTick(this.drawDiagnostics) }
    },
    computed: {
      editor () { return this.$refs.source.editor }
    },
    methods: {
      onChange (code) { this.$emit('update:value', code) },
      refresh () { this.editor.refresh() },
      jumpTo (item) {
        if (!item.line) return
        this.editor.setCursor(Math.max(0, Number(item.line) - 1), Math.max(0, Number(item.column || 1) - 1))
        this.editor.focus()
      },
      drawDiagnostics () {
        const editor = this.editor
        editor.clearGutter('fcu-errors')
        this.diagnostics.forEach(item => {
          const line = Number(item.line)
          if (!Number.isInteger(line) || line < 1 || line > editor.lineCount()) return
          const marker = document.createElement('span')
          marker.className = item.severity === 'warning' ? 'fcu-warning-marker' : item.severity === 'note' ? 'fcu-note-marker' : 'fcu-error-marker'
          marker.textContent = '●'
          marker.title = item.message || 'Compiler diagnostic'
          editor.setGutterMarker(line - 1, 'fcu-errors', marker)
        })
      }
    }
  }
</script>

<style lang="less" scoped>
  .fcu-c-editor { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
  .diagnostics { border-top: 1px solid var(--line); max-height: 84px; overflow: auto; background: var(--panel); flex: none; }
  .diagnostic { padding: 7px 14px; color: #ef746f; cursor: pointer; font-size: 12px; line-height: 1.4; }
  .diagnostic + .diagnostic { border-top: 1px solid var(--line); }
  .diagnostic.warning { color: #e5a856; }
  .diagnostic.note { color: #70aef7; }
</style>

<style>
  .fcu-c-editor .vue-codemirror-wrap { flex: 1; min-height: 0; overflow: hidden; }
  /* The upstream editor sets height:auto !important for standalone problem pages.
     This workspace needs a bounded CodeMirror so its own scroll area can move. */
  .fcu-c-editor .CodeMirror { height: 100% !important; font-size: 17px; line-height: 1.6; font-family: Menlo, Consolas, "Liberation Mono", monospace; }
  .fcu-c-editor .CodeMirror-scroll { min-height: 0; max-height: none; }
  .fcu-c-editor .cm-s-material-darker.CodeMirror { background: #262626; color: #e5e7eb; }
  .fcu-c-editor .cm-s-material-darker .CodeMirror-gutters { background: #262626; border-color: #363636; }
  .fcu-c-editor .fcu-errors { width: 12px; }
  .fcu-error-marker { color: #ed4014; }
  .fcu-warning-marker { color: #c4770a; }
  .fcu-note-marker { color: #2d8cf0; }
  .fcu-quiz-workspace .CodeMirror-hints { border: 1px solid #d7dbe0; border-radius: 7px; box-shadow: 0 8px 24px rgba(0, 0, 0, .18); font: 14px/1.5 Menlo, Consolas, monospace; max-height: 240px; padding: 4px; }
  .fcu-quiz-workspace .CodeMirror-hint { border-radius: 4px; padding: 4px 9px; }
  .fcu-quiz-workspace .CodeMirror-hint-active { background: #168553; color: #fff; }
  body.fcu-workspace-dark .CodeMirror-hints { background: #303030; border-color: #484848; color: #e5e7eb; }
</style>
