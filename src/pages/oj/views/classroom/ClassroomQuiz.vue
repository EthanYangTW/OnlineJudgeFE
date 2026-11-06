<template>
  <div class="fcu-quiz-page" :class="'theme-' + theme">
    <template v-if="quiz">
      <header class="workspace-topbar">
        <button class="icon-button back-button" type="button" aria-label="Back to classroom"
                @click="$router.push({name: 'fcu-classroom', params: {classSlug}})">
          <Icon type="chevron-left"></Icon>
        </button>
        <span class="quiz-name">{{ quiz.title }}</span>
        <span class="topbar-divider"></span>
        <label class="question-picker">
          <span class="sr-only">Choose problem</span>
          <select :value="selected ? selected.id : ''" @change="selectById($event.target.value)">
            <option v-for="item in questions" :key="item.id" :value="item.id">{{ item.title }}</option>
          </select>
          <Icon type="chevron-down"></Icon>
        </label>
        <span class="topbar-spacer"></span>
        <span class="mode-badge">{{ quiz.mode === 'exam' ? 'Exam' : 'Practice' }}</span>
        <span v-if="quiz.mode === 'exam'" class="timer"><Icon type="clock"></Icon> {{ remainingText }}</span>
        <button class="icon-button theme-button" type="button" :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
                :title="theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="toggleTheme">
          <Icon :type="theme === 'dark' ? 'ios-sunny-outline' : 'ios-moon-outline'"></Icon>
        </button>
      </header>

      <div class="workspace-grid" v-if="selected">
        <section class="workspace-panel description-panel" aria-label="Problem">
          <nav class="pane-tabs" aria-label="Problem tabs">
            <button type="button" :class="{active: descriptionTab === 'description'}" @click="descriptionTab = 'description'">Description</button>
            <button type="button" :class="{active: descriptionTab === 'submissions'}" @click="descriptionTab = 'submissions'">My Submissions</button>
            <button v-if="quiz.mode === 'practice'" type="button" :class="{active: descriptionTab === 'status'}" @click="showSocial('status')">Status</button>
            <button v-if="quiz.mode === 'practice'" type="button" :class="{active: descriptionTab === 'leaderboard'}" @click="showSocial('leaderboard')">Leaderboard</button>
          </nav>

          <div class="pane-scroll description-content" v-if="descriptionTab === 'description'">
            <h1>{{ selected.title }}</h1>
            <div class="problem-meta">
              <span class="meta-pill">{{ selected.kind === 'c_lab' ? 'C17' : 'Multiple Choice' }}</span>
              <span class="meta-pill">{{ selected.points }} pts</span>
              <span class="meta-pill subdued">Best {{ scoreFor(selected) }} pts</span>
            </div>
            <p v-if="error" class="inline-error">{{ error }}</p>
            <p v-if="!quiz.open || expired" class="inline-note">This exam has ended. You can still review your scores and submissions.</p>
            <div class="question-prompt">{{ selected.prompt }}</div>
            <template v-if="selected.kind === 'c_lab' && problemDetails">
              <div v-if="problemDetails.description" class="prose-section">
                <h2>Description</h2><p>{{ plainText(problemDetails.description) }}</p>
              </div>
              <div v-if="problemDetails.input_description" class="prose-section">
                <h2>Input</h2><p>{{ plainText(problemDetails.input_description) }}</p>
              </div>
              <div v-if="problemDetails.output_description" class="prose-section">
                <h2>Output</h2><p>{{ plainText(problemDetails.output_description) }}</p>
              </div>
              <div v-for="(sample, index) in problemDetails.samples || []" :key="index" class="example">
                <h2>Case {{ index + 1 }}</h2>
                <div class="example-line"><strong>Input:</strong><pre>{{ sample.input }}</pre></div>
                <div class="example-line"><strong>Output:</strong><pre>{{ sample.output }}</pre></div>
              </div>
            </template>
            <p v-if="selected.kind === 'c_lab'" class="problem-footnote">Write a complete C17 program. Read from standard input and write to standard output.</p>
          </div>

          <div class="pane-scroll records-content" v-else-if="descriptionTab === 'submissions'">
            <div class="records-heading"><h2>My Submissions</h2><button type="button" @click="loadHistory">Refresh</button></div>
            <p v-if="historyLoading" class="empty-state">Loading submissions…</p>
            <p v-else-if="!selectedAttempts.length" class="empty-state">No submissions yet.</p>
            <article v-for="item in selectedAttempts" :key="item.id || item.submissionId || item.at" class="submission-row">
              <div><strong :class="verdictClass(item)">{{ verdictText(item) }}</strong><small>{{ when(item) }}</small></div>
              <span>{{ item.earned || 0 }} / {{ item.max || selected.points }} pts</span>
              <button v-if="item.submissionId" type="button" @click="showSubmissionResult(item)">Result details</button>
              <button v-if="item.code" type="button" @click="restoreCode(item)">View code</button>
            </article>
          </div>

          <div class="pane-scroll records-content" v-else-if="descriptionTab === 'status'">
            <div class="records-heading"><h2>Class Activity</h2><button type="button" @click="loadSocial('status')">Refresh</button></div>
            <p v-if="socialLoading" class="empty-state">Loading…</p>
            <p v-else-if="socialError" class="inline-error">{{ socialError }}</p>
            <p v-else-if="!statusEntries.length" class="empty-state">No submissions yet.</p>
            <article v-for="(item, index) in statusEntries" :key="index" class="submission-row">
              <div><strong>{{ item.name || item.login }}</strong><small>{{ item.questionTitle }} · {{ when({at: item.at}) }}</small></div>
              <span>{{ item.earned }} / {{ item.maxScore }} pts</span>
              <span :class="verdictClass(item)">{{ verdictText(item) }}</span>
            </article>
            <p class="privacy-note">Only practice scores and status are visible. Other students’ code is private.</p>
          </div>

          <div class="pane-scroll records-content" v-else>
            <div class="records-heading"><h2>Practice Leaderboard</h2><button type="button" @click="loadSocial('leaderboard')">Refresh</button></div>
            <p v-if="socialLoading" class="empty-state">Loading…</p>
            <p v-else-if="socialError" class="inline-error">{{ socialError }}</p>
            <p v-else-if="!leaderboardEntries.length" class="empty-state">No scores yet.</p>
            <article v-for="item in leaderboardEntries" :key="item.login" class="leader-row">
              <strong class="rank">{{ item.rank }}</strong>
              <span class="leader-name">{{ item.name || item.login }}<small>{{ item.login }}</small></span>
              <strong>{{ item.score }} / {{ item.maxScore }}</strong>
            </article>
            <p class="privacy-note">Practice mode only. Exam scores and rankings are teacher-only.</p>
          </div>
        </section>

        <section class="workspace-panel work-panel" :style="{'--console-height': consoleHeight + 'px'}" aria-label="Coding workspace">
          <div class="code-panel" v-if="selected.kind === 'c_lab'">
            <div class="code-header">
              <span><Icon type="code-working"></Icon> Code</span>
              <span class="language-label">C17</span>
              <span class="code-header-spacer"></span>
              <span class="completion-note">Autocomplete · Tab to accept · Ctrl + Space</span>
            </div>
            <div class="editor-slot"><CEditor ref="cEditor" :value.sync="code" :diagnostics="diagnostics" :disabled="submitting || expired || !quiz.open" :theme="theme"/></div>
            <div class="editor-status"><span>{{ saveStatus || 'Autosave' }}</span><span>{{ syntaxStatus }}</span></div>
          </div>
          <div class="choice-panel" v-else>
            <div class="code-header"><span><Icon type="ios-list-outline"></Icon> Choose answer</span></div>
            <div class="choice-content">
              <label v-for="(choice, index) in selected.choices" :key="index" class="choice-option" :class="{selected: choiceIndex === index}">
                <input v-model="choiceIndex" type="radio" :value="index" :disabled="!quiz.open || expired">
                <span class="choice-letter">{{ String.fromCharCode(65 + index) }}</span>
                <span>{{ choice }}</span>
              </label>
            </div>
          </div>

          <div class="resize-handle" title="Drag to resize the lower panel" @mousedown="beginResize"><span></span></div>
          <div class="console-panel">
            <nav class="pane-tabs console-tabs" aria-label="Run and results">
              <button type="button" :class="{active: consoleTab === 'testcase'}" @click="consoleTab = 'testcase'">Testcase</button>
              <button type="button" :class="{active: consoleTab === 'result'}" @click="consoleTab = 'result'">Test Result</button>
            </nav>
            <div class="console-scroll" v-if="consoleTab === 'testcase'">
              <template v-if="selected.kind === 'c_lab'">
                <div class="case-tabs">
                  <button v-for="(sample, index) in sampleCases" :key="index" type="button"
                          :class="{active: caseIndex === index}" @click="chooseCase(index)">Case {{ index + 1 }}</button>
                  <button type="button" :class="{active: caseIndex === -1}" @click="chooseCase(-1)">Custom input</button>
                </div>
                <label class="field-label" for="fcu-stdin">Standard input (stdin)</label>
                <textarea id="fcu-stdin" v-model="testInput" rows="4" maxlength="8000" spellcheck="false"
                          placeholder="Enter test input here. Run executes only this input and does not affect your score."></textarea>
                <template v-if="activeExpected !== null">
                  <span class="field-label">Expected output</span>
                  <pre class="io-box">{{ activeExpected }}</pre>
                </template>
              </template>
              <p v-else class="empty-state">Choose an answer and press Submit to see your score.</p>
            </div>
            <div class="console-scroll" v-else>
              <div v-if="runResult" class="result-content">
                <h2 :class="runResult.status === 'ok' ? 'result-ok' : 'result-error'">{{ runStatusText(runResult.status) }}</h2>
                <p class="result-meta" v-if="runResult.timeMs !== undefined">Runtime {{ runResult.timeMs }} ms · custom test, not graded</p>
                <span class="field-label">Standard input</span><pre class="io-box">{{ lastRunInput }}</pre>
                <span class="field-label">Your output</span><pre class="io-box">{{ runResult.stdout || '(no output)' }}</pre>
                <template v-if="lastRunExpected !== null"><span class="field-label">Expected output</span><pre class="io-box">{{ lastRunExpected }}</pre></template>
                <template v-if="runResult.stderr"><span class="field-label">Compiler or runtime messages</span><pre class="io-box output-error">{{ runResult.stderr }}</pre></template>
              </div>
              <div v-else-if="submissionId" class="result-content">
                <h2 :class="judgeResult && judgeResult.type === 'success' ? 'result-ok' : 'result-title'">{{ judgeResult ? judgeResult.title : 'Judging…' }}</h2>
                <p v-if="judgeResult" class="result-meta">
                  <span v-if="judgeResult.score !== null && judgeResult.score !== undefined">This submission {{ judgeResult.score }} / {{ selected.points }} pts · </span>
                  Best {{ scoreFor(selected) }} / {{ selected.points }} pts
                </p>
                <p v-if="judgeResult && judgeResult.feedback" class="result-feedback">{{ judgeResult.feedback }}</p>
                <p v-if="judgeResult && judgeResult.message" class="output-error">{{ judgeResult.message }}</p>
                <p v-if="!judgeResult" class="result-meta">Code received. Grading with hidden tests. Submission: {{ submissionId }}</p>
                <div v-if="quiz.mode === 'practice' && judgeCases.length" class="judge-cases">
                  <div class="judge-cases-heading">
                    <h3>Judging tests</h3>
                    <button type="button" :disabled="runningAllCases || !judgeCode || !quiz.open || expired" @click="runAllJudgingCases">
                      {{ runningAllCases ? 'Running cases…' : 'Run all inputs' }}
                    </button>
                  </div>
                  <article v-for="item in judgeCases" :key="item.number" class="judge-case">
                    <div class="judge-case-heading">
                      <strong>Case {{ item.number }} · {{ caseVerdict(item) }}</strong>
                      <span>{{ item.earnedWeight }} / {{ item.maxWeight }} test weight</span>
                    </div>
                    <span class="field-label">Input{{ item.inputTruncated ? ' (first 16 KB)' : '' }}</span>
                    <pre class="io-box">{{ item.input || '(empty)' }}</pre>
                    <span class="field-label">Expected output{{ item.expectedTruncated ? ' (first 16 KB)' : '' }}</span>
                    <pre class="io-box">{{ item.expected || '(empty)' }}</pre>
                    <button type="button" class="case-run-button" :disabled="item.running || item.inputTruncated || !judgeCode || !quiz.open || expired"
                            @click="runJudgingCase(item)">{{ item.running ? 'Running…' : 'Run submitted code on this input' }}</button>
                    <small v-if="item.inputTruncated">This input is too large for the browser runner.</small>
                    <template v-if="item.runStatus">
                      <span class="field-label">Your output · {{ runStatusText(item.runStatus) }}</span>
                      <pre class="io-box">{{ item.actualOutput || '(no output)' }}</pre>
                      <pre v-if="item.runError" class="io-box output-error">{{ item.runError }}</pre>
                    </template>
                  </article>
                </div>
              </div>
              <div v-else-if="judgeResult" class="result-content"><h2>{{ judgeResult.title }}</h2><p class="result-meta">Problem score {{ judgeResult.score }} / {{ selected.points }}</p></div>
              <p v-else class="empty-state">Run with sample or custom input. Submit grades against hidden tests.</p>
            </div>
            <footer class="console-footer">
              <button v-if="selected.kind === 'c_lab'" class="syntax-button" type="button" :disabled="checking || !code.trim() || !quiz.open || expired" @click="checkCode(true)">Check Syntax</button>
              <span class="footer-spacer"></span>
              <button v-if="selected.kind === 'c_lab'" class="run-button" type="button" :disabled="runLoading || submitting || !code.trim() || !quiz.open || expired" @click="runCode">
                {{ runLoading ? 'Running…' : 'Run' }}
              </button>
              <button class="submit-button" type="button"
                      :disabled="submitting || runLoading || !quiz.open || expired || (selected.kind === 'c_lab' ? !code.trim() : choiceIndex === null)"
                      @click="selected.kind === 'c_lab' ? submitCode() : submitChoice()">
                {{ submitting ? 'Judging…' : 'Submit' }}
              </button>
            </footer>
          </div>
        </section>
      </div>
      <div v-else class="no-question">No published problems yet.</div>
    </template>
    <div v-else class="workspace-loading">{{ loading ? 'Loading quiz…' : (error || 'Quiz not found.') }}</div>
    <Modal v-model="showCode" title="My submitted code" :width="720">
      <pre class="saved-code">{{ inspectedCode }}</pre>
      <div slot="footer"><Button @click="showCode = false">Close</Button></div>
    </Modal>
  </div>
</template>

<script>
  import fcuApi from '@oj/fcuApi'
  import {JUDGE_STATUS} from '@/utils/constants'
  import CEditor from './CEditor.vue'

  function timestamp (value) {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return value < 100000000000 ? value * 1000 : value
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  function parseDiagnostics (message) {
    return String(message || '').split('\n').reduce((items, line) => {
      const match = line.match(/:(\d+):(\d+):\s*(warning|error|fatal error):\s*(.*)$/)
      if (match) items.push({line: Number(match[1]), column: Number(match[2]), severity: match[3] === 'warning' ? 'warning' : 'error', message: match[4]})
      return items
    }, [])
  }

  export default {
    name: 'FcuClassroomQuiz',
    components: {CEditor},
    data () {
      return {
        classSlug: this.$route.params.classSlug,
        quizId: this.$route.params.quizId,
        quiz: null,
        selected: null,
        scores: {},
        drafts: {},
        attempts: [],
        code: '',
        choiceIndex: null,
        loading: true,
        historyLoading: false,
        submitting: false,
        saveStatus: '',
        error: '',
        diagnostics: [],
        judgeResult: null,
        judgeCases: [],
        judgeCode: '',
        runningAllCases: false,
        problemDetails: null,
        submissionId: null,
        showCode: false,
        inspectedCode: '',
        serverOffset: 0,
        now: Date.now(),
        tick: null,
        saveTimer: null,
        checkTimer: null,
        checking: false,
        syntaxStatus: '',
        checkSerial: 0,
        pollTimer: null,
        theme: window.localStorage.getItem('fcu-workspace-theme') === 'light' ? 'light' : 'dark',
        descriptionTab: 'description',
        consoleTab: 'testcase',
        caseIndex: 0,
        testInput: '',
        lastRunInput: '',
        lastRunExpected: null,
        runResult: null,
        runLoading: false,
        consoleHeight: 280,
        resizeStartY: 0,
        resizeStartHeight: 360,
        statusEntries: [],
        leaderboardEntries: [],
        socialLoading: false,
        socialError: ''
      }
    },
    created () {
      this.load()
      this.tick = setInterval(() => {
        this.now = Date.now()
        if (this.expired && this.quiz && this.quiz.open) this.quiz.open = false
      }, 1000)
    },
    mounted () { this.applyBodyTheme() },
    beforeDestroy () {
      document.body.classList.remove('fcu-classroom-view', 'fcu-quiz-workspace', 'fcu-workspace-dark')
      document.removeEventListener('mousemove', this.resizeMove)
      document.removeEventListener('mouseup', this.endResize)
      clearInterval(this.tick)
      clearTimeout(this.saveTimer)
      clearTimeout(this.checkTimer)
      clearTimeout(this.pollTimer)
    },
    watch: {
      code (value) {
        if (!this.selected || this.selected.kind !== 'c_lab' || !this.quiz || !this.quiz.open) return
        this.saveStatus = 'Not saved'
        clearTimeout(this.saveTimer)
        const questionId = this.selected.id
        this.saveTimer = setTimeout(() => this.saveDraft(questionId, value), 1100)
        this.syntaxStatus = ''
        clearTimeout(this.checkTimer)
        if (value.trim()) this.checkTimer = setTimeout(() => this.checkCode(false), 2600)
      }
    },
    computed: {
      questions () { return this.quiz ? (this.quiz.questions || []).filter(item => item.published) : [] },
      selectedAttempts () { return this.attempts.filter(item => Number(item.questionId || item.question_id) === Number(this.selected && this.selected.id)) },
      sampleCases () { return this.problemDetails && this.problemDetails.samples ? this.problemDetails.samples : [] },
      activeExpected () {
        if (this.caseIndex < 0 || !this.sampleCases[this.caseIndex]) return null
        const sample = this.sampleCases[this.caseIndex]
        return this.testInput === sample.input ? sample.output : null
      },
      expired () {
        if (!this.quiz || this.quiz.mode !== 'exam') return false
        const end = timestamp(this.quiz.endsAt)
        return end !== null && end <= this.now + this.serverOffset
      },
      remainingText () {
        const end = this.quiz ? timestamp(this.quiz.endsAt) : null
        if (end === null) return '—'
        const seconds = Math.max(0, Math.floor((end - this.now - this.serverOffset) / 1000))
        return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map(value => String(value).padStart(2, '0')).join(':')
      }
    },
    methods: {
      applyBodyTheme () {
        document.body.classList.add('fcu-classroom-view', 'fcu-quiz-workspace')
        document.body.classList.toggle('fcu-workspace-dark', this.theme === 'dark')
      },
      toggleTheme () {
        this.theme = this.theme === 'dark' ? 'light' : 'dark'
        window.localStorage.setItem('fcu-workspace-theme', this.theme)
        this.applyBodyTheme()
      },
      selectById (id) {
        const item = this.questions.find(question => String(question.id) === String(id))
        if (item) this.select(item)
      },
      chooseCase (index) {
        this.caseIndex = index
        this.testInput = index >= 0 && this.sampleCases[index] ? this.sampleCases[index].input : ''
        this.consoleTab = 'testcase'
      },
      beginResize (event) {
        if (window.innerWidth < 900) return
        this.resizeStartY = event.clientY
        this.resizeStartHeight = this.consoleHeight
        document.addEventListener('mousemove', this.resizeMove)
        document.addEventListener('mouseup', this.endResize)
        event.preventDefault()
      },
      resizeMove (event) {
        const panel = this.$el.querySelector('.work-panel')
        const maxHeight = panel ? panel.clientHeight - 265 : window.innerHeight - 300
        this.consoleHeight = Math.max(180, Math.min(maxHeight,
          this.resizeStartHeight + this.resizeStartY - event.clientY))
      },
      endResize () {
        document.removeEventListener('mousemove', this.resizeMove)
        document.removeEventListener('mouseup', this.endResize)
        this.$nextTick(() => { if (this.$refs.cEditor) this.$refs.cEditor.refresh() })
      },
      showSocial (tab) {
        this.descriptionTab = tab
        this.loadSocial(tab)
      },
      async loadSocial (tab) {
        if (!this.quiz || this.quiz.mode !== 'practice') return
        this.socialLoading = true
        this.socialError = ''
        try {
          const result = tab === 'status'
            ? await fcuApi.practiceStatus(this.classSlug, this.quizId)
            : await fcuApi.practiceLeaderboard(this.classSlug, this.quizId)
          if (tab === 'status') this.statusEntries = result.entries || []
          else this.leaderboardEntries = result.entries || []
        } catch (error) {
          this.socialError = error.message || 'Could not load practice data.'
        } finally {
          this.socialLoading = false
        }
      },
      runStatusText (status) {
        return ({
          ok: 'Run completed',
          compile_error: 'Compilation Error',
          runtime_error: 'Runtime Error',
          time_limit: 'Time limit exceeded',
          memory_limit: 'Memory limit exceeded',
          output_limit: 'Output limit exceeded',
          system_error: 'Run service temporarily unavailable'
        })[status] || 'Run result'
      },
      verdictClass (attempt) {
        const value = attempt.verdict === undefined || attempt.verdict === null ? attempt.result : attempt.verdict
        if (String(value) === '0' || value === 'correct') return 'result-ok'
        if (String(value) === '8' || String(value) === '6' || String(value) === '7') return 'result-title'
        return 'result-error'
      },
      async runCode () {
        if (!this.selected || this.selected.kind !== 'c_lab' || !this.code.trim() ||
            !this.quiz || !this.quiz.open || this.expired || this.runLoading) return
        const questionId = this.selected.id
        this.runLoading = true
        this.consoleTab = 'result'
        this.runResult = null
        this.judgeResult = null
        this.judgeCases = []
        this.judgeCode = ''
        this.submissionId = null
        this.lastRunInput = this.testInput
        this.lastRunExpected = this.activeExpected
        try {
          const result = await fcuApi.run(this.classSlug, this.quizId, questionId,
            this.code, this.testInput)
          if (!this.selected || this.selected.id !== questionId) return
          this.runResult = result
          if (this.runResult.status === 'compile_error') {
            this.diagnostics = parseDiagnostics(this.runResult.stderr)
          }
        } catch (error) {
          if (this.selected && this.selected.id === questionId) {
            this.runResult = {status: 'system_error', stdout: '', stderr: error.message || 'Run failed.'}
          }
        } finally {
          this.runLoading = false
        }
      },
      async load () {
        this.loading = true
        this.error = ''
        try {
          const state = await fcuApi.state(this.classSlug)
          const quiz = (state.quizzes || []).find(item => String(item.id) === String(this.quizId))
          if (!quiz || !quiz.published) throw new Error('Quiz not found.')
          this.quiz = quiz
          this.scores = state.scores || {}
          this.drafts = state.drafts || {}
          const serverNow = timestamp(state.serverNow)
          this.serverOffset = serverNow === null ? 0 : serverNow - Date.now()
          if (this.questions.length) this.select(this.questions[0])
          this.loadHistory()
        } catch (error) {
          this.error = error.message || 'Could not load quiz.'
        } finally {
          this.loading = false
        }
      },
      async loadHistory () {
        this.historyLoading = true
        try { this.attempts = await fcuApi.attempts(this.classSlug, this.quizId) || [] } catch (error) { this.attempts = [] }
        this.historyLoading = false
      },
      select (item) {
        if (this.selected && this.selected.id === item.id) return
        clearTimeout(this.saveTimer)
        clearTimeout(this.checkTimer)
        clearTimeout(this.pollTimer)
        this.checkSerial++
        if (this.selected && this.selected.kind === 'c_lab' && this.quiz.open) this.saveDraft(this.selected.id, this.code)
        this.selected = item
        this.code = this.drafts[item.id] || ''
        this.choiceIndex = null
        this.diagnostics = []
        this.syntaxStatus = ''
        this.problemDetails = null
        this.judgeResult = null
        this.judgeCases = []
        this.judgeCode = ''
        this.runningAllCases = false
        this.submissionId = null
        this.runResult = null
        this.submitting = false
        this.consoleTab = 'testcase'
        this.descriptionTab = 'description'
        this.caseIndex = 0
        this.testInput = ''
        this.saveStatus = ''
        if (item.kind === 'c_lab' && item.problemDisplayId && this.quiz.open) this.loadProblem(item)
      },
      async loadProblem (item) {
        try {
          const details = await fcuApi.problem(this.quiz, item)
          if (this.selected && this.selected.id === item.id) {
            this.problemDetails = details
            this.chooseCase(details.samples && details.samples.length ? 0 : -1)
          }
        } catch (error) {
          if (this.selected && this.selected.id === item.id) this.error = error.message || 'Could not load problem details.'
        }
      },
      plainText (value) {
        return String(value || '').replace(/<br\s*\/?\s*>/gi, '\n')
          .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
          .replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ')
          .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
          .replace(/&amp;/gi, '&').trim()
      },
      async checkCode (manual) {
        if (!this.selected || this.selected.kind !== 'c_lab' || !this.quiz.open || this.expired || !this.code.trim() || this.checking) return
        const questionId = this.selected.id
        const code = this.code
        const serial = ++this.checkSerial
        this.checking = true
        if (manual) this.syntaxStatus = 'Checking…'
        try {
          const result = await fcuApi.check(this.classSlug, this.quizId, questionId, code)
          if (serial !== this.checkSerial || !this.selected || this.selected.id !== questionId || this.code !== code) return
          this.diagnostics = result.diagnostics || []
          this.syntaxStatus = result.ok ? 'Syntax check passed' : `${this.diagnostics.length} compiler diagnostics`
        } catch (error) {
          if (manual && serial === this.checkSerial) this.syntaxStatus = error.message || 'Syntax check failed'
        } finally { this.checking = false }
      },
      async saveDraft (questionId, code) {
        if (!this.quiz || !this.quiz.open || this.expired) return
        try {
          await fcuApi.saveDraft(this.classSlug, this.quizId, questionId, code)
          this.drafts[questionId] = code
          if (this.selected && this.selected.id === questionId && this.code === code) this.saveStatus = 'Saved'
        } catch (error) { if (this.selected && this.selected.id === questionId) this.saveStatus = 'Save failed' }
      },
      async submitChoice () {
        if (!this.selected || this.choiceIndex === null || !this.quiz.open || this.expired) return
        this.submitting = true
        this.error = ''
        try {
          const result = await fcuApi.submitChoice(this.classSlug, this.quizId, this.selected.id, this.choiceIndex)
          this.$Message[result.correct ? 'success' : 'info'](`Problem score: ${result.earned} / ${result.max}`)
          this.judgeResult = {title: 'Submitted', score: result.earned, type: result.correct ? 'success' : 'info'}
          this.consoleTab = 'result'
          this.runResult = null
          await this.refreshState()
          await this.loadHistory()
        } catch (error) { this.error = error.message || 'Submission failed.' }
        this.submitting = false
      },
      async submitCode () {
        if (!this.selected || !this.code.trim() || !this.quiz.open || this.expired) return
        const question = this.selected
        const code = this.code
        this.submitting = true
        this.error = ''
        clearTimeout(this.checkTimer)
        this.checkSerial++
        this.diagnostics = []
        this.judgeResult = null
        this.judgeCases = []
        this.judgeCode = ''
        try {
          await this.saveDraft(question.id, code)
          if (!this.selected || this.selected.id !== question.id) return
          const result = await fcuApi.submitCode(this.quiz, question, code)
          if (!this.selected || this.selected.id !== question.id) return
          this.submissionId = result.submission_id
          if (!this.submissionId) throw new Error('Code was submitted, but no submission ID was returned. Check My Submissions.')
          this.consoleTab = 'result'
          this.runResult = null
          this.pollSubmission(this.submissionId, 0, this.selected.id)
        } catch (error) {
          if (this.selected && this.selected.id === question.id) {
            this.error = error.message || 'Code submission failed.'
            this.submitting = false
          }
        }
      },
      async pollSubmission (id, count, questionId) {
        if (!this.selected || this.selected.id !== questionId) return
        if (count >= 40) {
          this.error = 'Judging is still in progress. Refresh My Submissions shortly.'
          this.submitting = false
          return
        }
        try {
          const result = await fcuApi.submission(id)
          if (!this.selected || this.selected.id !== questionId) return
          if ([6, 7, 9].indexOf(Number(result.result)) >= 0) {
            this.pollTimer = setTimeout(() => this.pollSubmission(id, count + 1, questionId), 1500)
            return
          }
          const status = JUDGE_STATUS[result.result] || {name: 'Judging complete', type: 'info'}
          const message = Number(result.result) === -2 && result.statistic_info ? result.statistic_info.err_info : ''
          this.diagnostics = parseDiagnostics(message)
          await this.refreshState()
          await this.loadHistory()
          if (!this.selected || this.selected.id !== questionId) return
          const attempt = this.attempts.find(item => item.submissionId === id)
          this.judgeResult = {title: status.name, type: status.type, message: String(message || ''),
            score: attempt ? attempt.earned : null, feedback: this.gradingFeedback(result)}
          this.judgeCode = (attempt && attempt.code) || result.code || ''
          await this.loadPracticeTests(id)
          this.submitting = false
        } catch (error) {
          if (!this.selected || this.selected.id !== questionId) return
          this.error = error.message || 'Could not fetch the result. Check My Submissions.'
          this.submitting = false
        }
      },
      gradingFeedback (submission) {
        const cases = submission.info && Array.isArray(submission.info.data) ? submission.info.data : []
        if (Number(submission.result) === 0) {
          return this.quiz.mode === 'practice' && cases.length
            ? `All ${cases.length} private tests passed.` : 'All private tests passed.'
        }
        if (this.quiz.mode !== 'practice') return 'Some private tests did not pass. Test details are not shown during exams.'
        if (!cases.length) return 'The submission did not pass every private test. Use Run with your own input to check your output.'
        const passed = cases.filter(item => Number(item.result) === 0).length
        const failed = cases.length - passed
        const reasons = [...new Set(cases.filter(item => Number(item.result) !== 0)
          .map(item => (JUDGE_STATUS[item.result] || {name: 'Not passed'}).name))].join(', ')
        return `${passed} of ${cases.length} private tests passed; ${failed} did not (${reasons}). ` +
          'Points follow the teacher\'s test weights. Judging inputs and expected outputs appear below.'
      },
      async showSubmissionResult (attempt) {
        if (!attempt.submissionId) return
        const questionId = this.selected && this.selected.id
        try {
          const result = await fcuApi.submission(attempt.submissionId)
          if (!this.selected || this.selected.id !== questionId) return
          const status = JUDGE_STATUS[result.result] || {name: 'Judging complete', type: 'info'}
          const message = Number(result.result) === -2 && result.statistic_info ? result.statistic_info.err_info : ''
          this.submissionId = attempt.submissionId
          this.judgeResult = {title: status.name, type: status.type, score: attempt.earned,
            feedback: this.gradingFeedback(result), message: String(message || '')}
          this.judgeCode = attempt.code || result.code || ''
          this.runResult = null
          this.consoleTab = 'result'
          await this.loadPracticeTests(attempt.submissionId)
        } catch (error) {
          this.error = error.message || 'Could not load the submission result.'
        }
      },
      async loadPracticeTests (submissionId) {
        this.judgeCases = []
        if (this.quiz.mode !== 'practice') return
        try {
          const result = await fcuApi.practiceTests(this.classSlug, this.quizId, submissionId)
          if (this.submissionId !== submissionId) return
          this.judgeCases = (result.cases || []).map(item => ({...item, running: false,
            runStatus: '', actualOutput: '', runError: ''}))
        } catch (error) {
          this.error = error.message || 'Could not load judging tests.'
        }
      },
      caseVerdict (item) {
        return item.verdict === null ? 'Not run' :
          ((JUDGE_STATUS[item.verdict] || {name: 'Judged'}).name)
      },
      async runJudgingCase (item) {
        if (!this.judgeCode || item.running || item.inputTruncated || !this.selected) return
        this.$set(item, 'running', true)
        try {
          const result = await fcuApi.run(this.classSlug, this.quizId, this.selected.id,
            this.judgeCode, item.input)
          this.$set(item, 'actualOutput', result.stdout || '')
          this.$set(item, 'runError', result.stderr || '')
          this.$set(item, 'runStatus', result.status)
        } catch (error) {
          this.$set(item, 'actualOutput', '')
          this.$set(item, 'runError', error.message || 'Run failed.')
          this.$set(item, 'runStatus', 'system_error')
        } finally {
          this.$set(item, 'running', false)
        }
      },
      async runAllJudgingCases () {
        if (this.runningAllCases) return
        const submissionId = this.submissionId
        this.runningAllCases = true
        try {
          for (const item of this.judgeCases) {
            if (this.submissionId !== submissionId) break
            await this.runJudgingCase(item)
          }
        } finally {
          this.runningAllCases = false
        }
      },
      async refreshState () {
        const state = await fcuApi.state(this.classSlug)
        this.scores = state.scores || {}
        const fresh = (state.quizzes || []).find(item => String(item.id) === String(this.quizId))
        if (fresh) {
          this.quiz = fresh
          if (fresh.mode !== 'practice') {
            this.statusEntries = []
            this.leaderboardEntries = []
            if (this.descriptionTab === 'status' || this.descriptionTab === 'leaderboard') {
              this.descriptionTab = 'description'
            }
          }
        }
      },
      scoreFor (question) { return (this.scores[question.id] || {}).best || 0 },
      verdictText (attempt) {
        const value = attempt.verdict === undefined || attempt.verdict === null ? attempt.result : attempt.verdict
        return JUDGE_STATUS[value] ? JUDGE_STATUS[value].name : (value || '—')
      },
      when (attempt) {
        const time = timestamp(attempt.createdAt || attempt.created_at || attempt.at)
        return time === null ? '—' : new Date(time).toLocaleString()
      },
      restoreCode (attempt) {
        if (!attempt.code || !this.selected || this.selected.kind !== 'c_lab') return
        this.inspectedCode = attempt.code
        this.showCode = true
      }
    }
  }
</script>

<style lang="less" scoped>
  .theme-dark {
    --canvas: #1b1b1b; --panel: #262626; --bar: #303030; --soft: #333333;
    --line: #3c3c3c; --text: #f0f0f0; --muted: #a8a8a8; --accent: #2cbb72;
    --field: #343434; --blue: #82aaff;
  }
  .theme-light {
    --canvas: #f5f6f8; --panel: #ffffff; --bar: #f7f7f8; --soft: #f1f2f4;
    --line: #e2e4e8; --text: #262a30; --muted: #69717c; --accent: #169c5e;
    --field: #f4f5f6; --blue: #286de3;
  }
  .fcu-quiz-page {
    height: calc(100vh - 60px); min-height: 560px; display: flex; flex-direction: column;
    background: var(--canvas); color: var(--text); font-family: -apple-system, BlinkMacSystemFont,
      "Segoe UI", "Noto Sans TC", Arial, sans-serif; font-size: 16px;
  }
  button, select, textarea { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .48; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
  .workspace-topbar {
    flex: none; display: flex; align-items: center; gap: 12px; height: 54px; padding: 0 14px;
    border-bottom: 1px solid var(--line); background: var(--panel); min-width: 0;
  }
  .icon-button { border: 0; color: var(--muted); background: transparent; width: 30px; height: 30px; border-radius: 5px; font-size: 19px; }
  .icon-button:hover { color: var(--text); background: var(--soft); }
  .quiz-name { font-size: 14px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
  .topbar-divider { width: 1px; height: 20px; background: var(--line); flex: none; }
  .question-picker { position: relative; display: flex; align-items: center; min-width: 0; }
  .question-picker select { appearance: none; border: 0; background: transparent; color: var(--text); font-weight: 600; padding: 7px 22px 7px 2px; max-width: 270px; outline: none; cursor: pointer; white-space: nowrap; text-overflow: ellipsis; }
  .question-picker option { color: #262a30; }
  .question-picker .ivu-icon { pointer-events: none; position: absolute; right: 2px; color: var(--muted); font-size: 12px; }
  .topbar-spacer, .code-header-spacer, .footer-spacer { flex: 1; }
  .mode-badge { border-radius: 4px; padding: 4px 8px; color: var(--accent); background: var(--soft); font-size: 12px; font-weight: 700; }
  .timer { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; color: var(--text); }
  .timer .ivu-icon { color: var(--accent); margin-right: 4px; }
  .workspace-grid { display: grid; grid-template-columns: minmax(0, 48%) minmax(0, 52%); gap: 9px; flex: 1; min-height: 0; padding: 9px; }
  .workspace-panel { background: var(--panel); border: 1px solid var(--line); border-radius: 9px; min-width: 0; min-height: 0; overflow: hidden; }
  .description-panel, .work-panel { display: flex; flex-direction: column; }
  .pane-tabs { flex: none; height: 56px; display: flex; align-items: stretch; gap: 3px; background: var(--bar); border-bottom: 1px solid var(--line); padding: 0 14px; overflow-x: auto; }
  .pane-tabs button { flex: none; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); font-size: 16px; font-weight: 500; padding: 0 14px; white-space: nowrap; }
  .pane-tabs button:hover { color: var(--text); }
  .pane-tabs button.active { color: var(--text); border-bottom-color: var(--accent); }
  .pane-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 30px 34px 44px; }
  .description-content h1 { font-size: 34px; line-height: 1.3; margin: 0 0 20px; font-weight: 650; letter-spacing: -.5px; }
  .problem-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 27px; }
  .meta-pill { background: var(--soft); border: 1px solid var(--line); color: var(--accent); padding: 5px 11px; border-radius: 20px; font-size: 14px; font-weight: 600; }
  .meta-pill.subdued { color: var(--muted); }
  .question-prompt, .prose-section p { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 19px; line-height: 1.65; margin: 0 0 28px; }
  .prose-section h2, .example h2 { font-size: 20px; margin: 30px 0 12px; font-weight: 650; }
  .example { margin-top: 29px; }
  .example-line { display: flex; align-items: flex-start; gap: 10px; background: var(--soft); border-radius: 6px; padding: 11px 13px; margin: 6px 0; }
  .example-line strong { color: var(--muted); min-width: 58px; }
  .example-line pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: Menlo, Consolas, monospace; }
  .problem-footnote, .privacy-note { color: var(--muted); font-size: 14px; line-height: 1.7; margin-top: 28px; }
  .inline-error, .inline-note { padding: 10px 12px; border-radius: 6px; margin-bottom: 18px; }
  .inline-error { color: #ed7770; background: rgba(237, 119, 112, .1); }
  .inline-note { color: var(--muted); background: var(--soft); }
  .records-content { padding-top: 24px; }
  .records-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
  .records-heading h2 { margin: 0; font-size: 19px; }
  .records-heading button, .submission-row button { border: 0; background: transparent; color: var(--blue); padding: 5px; }
  .submission-row, .leader-row { border-top: 1px solid var(--line); display: flex; align-items: center; gap: 13px; padding: 14px 2px; }
  .submission-row > div { flex: 1; min-width: 0; }
  .submission-row strong { display: block; }
  .submission-row small, .leader-name small { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
  .submission-row > span { white-space: nowrap; }
  .result-ok { color: #35b976; }
  .result-error { color: #ed7770; }
  .result-title { color: var(--text); }
  .leader-row .rank { color: var(--muted); width: 24px; }
  .leader-name { flex: 1; min-width: 0; }
  .empty-state { color: var(--muted); padding: 24px 3px; line-height: 1.6; }
  .work-panel { background: var(--panel); }
  .code-panel, .choice-panel { flex: 1; min-height: 165px; display: flex; flex-direction: column; }
  .code-header { height: 54px; flex: none; display: flex; align-items: center; gap: 13px; background: var(--bar); border-bottom: 1px solid var(--line); padding: 0 17px; font-weight: 600; }
  .code-header .ivu-icon { font-size: 17px; color: var(--accent); margin-right: 4px; }
  .language-label { color: var(--muted); font-size: 14px; font-weight: 500; }
  .completion-note { color: var(--muted); font-size: 13px; font-weight: 400; white-space: nowrap; }
  .editor-slot { flex: 1; min-height: 0; overflow: hidden; }
  .editor-status { height: 30px; flex: none; display: flex; justify-content: space-between; padding: 5px 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
  .choice-content { padding: 26px 30px; overflow-y: auto; }
  .choice-option { display: flex; align-items: center; gap: 15px; background: var(--soft); border: 1px solid var(--line); border-radius: 7px; padding: 13px; margin-bottom: 11px; cursor: pointer; line-height: 1.6; }
  .choice-option.selected { border-color: var(--accent); }
  .choice-option input { accent-color: var(--accent); }
  .choice-letter { color: var(--muted); font-weight: 700; }
  .resize-handle { height: 9px; flex: none; cursor: row-resize; display: flex; align-items: center; justify-content: center; background: var(--canvas); }
  .resize-handle span { width: 38px; height: 3px; border-radius: 3px; background: var(--line); }
  .console-panel { flex: none; height: ~"min(var(--console-height), calc(100% - 265px))"; min-height: 180px; display: flex; flex-direction: column; }
  .console-tabs { height: 52px; }
  .console-scroll { overflow-y: auto; flex: 1; min-height: 0; padding: 20px 20px 14px; }
  .case-tabs { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 20px; }
  .case-tabs button { border: 0; background: transparent; color: var(--muted); border-radius: 5px; padding: 9px 14px; }
  .case-tabs button.active { color: var(--text); background: var(--soft); }
  .field-label { display: block; color: var(--muted); font-size: 14px; font-weight: 600; margin: 13px 0 7px; }
  .console-scroll textarea, .io-box { width: 100%; border: 0; border-radius: 6px; background: var(--field); color: var(--text); padding: 12px 13px; font: 15px/1.6 Menlo, Consolas, monospace; resize: vertical; outline: none; }
  .console-scroll textarea:focus { box-shadow: inset 0 0 0 1px var(--accent); }
  .io-box { min-height: 40px; white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; }
  .output-error { color: #ed7770; white-space: pre-wrap; }
  .result-content h2 { margin: 0 0 8px; font-size: 19px; }
  .result-meta { color: var(--muted); font-size: 12px; }
  .result-feedback { max-width: 680px; line-height: 1.6; }
  .judge-cases { margin-top: 20px; }
  .judge-cases-heading, .judge-case-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .judge-cases-heading h3 { margin: 0; font-size: 16px; }
  .judge-cases-heading button, .case-run-button { border: 1px solid var(--line); border-radius: 6px; background: var(--soft); color: var(--text); padding: 7px 10px; cursor: pointer; }
  .judge-cases-heading button:disabled, .case-run-button:disabled { opacity: .55; cursor: default; }
  .judge-case { padding: 15px 0 18px; border-top: 1px solid var(--line); }
  .judge-case-heading strong { font-size: 13px; }
  .judge-case-heading span { color: var(--muted); font-size: 12px; }
  .case-run-button { margin-top: 10px; }
  .console-footer { height: 60px; flex: none; display: flex; align-items: center; gap: 10px; padding: 0 16px; border-top: 1px solid var(--line); }
  .console-footer button { border: 0; border-radius: 6px; padding: 8px 16px; font-weight: 650; }
  .syntax-button { background: transparent; color: var(--muted); }
  .syntax-button:hover { color: var(--text); }
  .run-button { background: var(--soft); color: var(--text); }
  .submit-button { background: var(--accent); color: #fff; }
  .no-question, .workspace-loading { padding: 40px; color: var(--muted); }
  .saved-code { max-height: 58vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-family: Menlo, Consolas, monospace; }
  @media (max-width: 900px) {
    .fcu-quiz-page { height: auto; min-height: calc(100vh - 60px); overflow: visible; }
    .workspace-grid { display: flex; flex-direction: column; overflow: visible; }
    .description-panel { min-height: 350px; max-height: 460px; }
    .work-panel { min-height: 680px; }
    .code-panel { min-height: 320px; }
    .console-panel { height: 320px; }
    .resize-handle { display: none; }
    .description-content h1 { font-size: 27px; }
    .question-prompt, .prose-section p { font-size: 16px; }
    .prose-section h2, .example h2 { font-size: 18px; }
    .pane-tabs button { font-size: 14px; }
  }
  @media (max-width: 600px) {
    .workspace-topbar { gap: 7px; padding: 0 9px; }
    .quiz-name, .topbar-divider, .mode-badge { display: none; }
    .question-picker select { max-width: 175px; }
    .pane-scroll { padding: 22px 18px 30px; }
    .description-content h1 { font-size: 23px; }
    .completion-note { display: none; }
    .console-scroll { padding: 15px; }
  }
</style>

<style lang="less">
  body.fcu-quiz-workspace { overflow: hidden; }
  body.fcu-quiz-workspace .content-app { margin-top: 60px; padding: 0; height: calc(100vh - 60px); }
  body.fcu-quiz-workspace .footer, body.fcu-quiz-workspace .ivu-back-top { display: none; }
  body.fcu-workspace-dark #header, body.fcu-workspace-dark #header .oj-menu { background: #262626; color: #f0f0f0; }
  body.fcu-workspace-dark #header .ivu-menu-item { color: #b4b4b4; }
  body.fcu-workspace-dark #header .ivu-menu-item-active { color: #f0f0f0; }
  body.fcu-workspace-dark #header .drop-menu-title { color: #f0f0f0; }
  @media (max-width: 900px) {
    body.fcu-quiz-workspace { overflow: auto; }
    body.fcu-quiz-workspace .content-app { height: auto; }
  }
</style>
