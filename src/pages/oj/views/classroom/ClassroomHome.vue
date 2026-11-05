<template>
  <div class="classroom-home" :class="'theme-' + theme">
    <div class="home-topline">
      <span>FCU C Studio</span>
      <button type="button" class="theme-button" @click="toggleTheme"
              :aria-label="theme === 'dark' ? '切換淺色模式' : '切換深色模式'">
        {{ theme === 'dark' ? '淺色模式' : '深色模式' }}
      </button>
    </div>

    <div v-if="!initialized" class="loading-state">載入課堂…</div>

    <section v-else-if="needsLogin" class="login-card" aria-label="課堂登入">
      <p class="eyebrow">CLASSROOM ACCESS</p>
      <h1>登入 C 程式課堂</h1>
      <p class="login-intro">使用教師提供的課堂代碼與學號登入。此網站不開放自行註冊。</p>
      <div v-if="error" class="login-error" role="alert">{{ error }}</div>
      <form @submit.prevent="login">
        <label for="fcu-class-slug">課堂代碼</label>
        <input id="fcu-class-slug" v-model.trim="credentials.classSlug" autocomplete="off"
               placeholder="例如：fcu-c" spellcheck="false"/>
        <label for="fcu-student-id">學號</label>
        <input id="fcu-student-id" v-model.trim="credentials.login" autocomplete="username"
               spellcheck="false"/>
        <label for="fcu-password">密碼</label>
        <input id="fcu-password" v-model="credentials.password" type="password"
               autocomplete="current-password"/>
        <button type="submit" class="login-submit" :disabled="working">
          {{ working ? '登入中…' : '登入課堂' }}
        </button>
      </form>
    </section>

    <section v-else class="classroom-board">
      <div class="board-heading">
        <div>
          <p class="eyebrow">MY CLASSROOM</p>
          <h1>{{ classroom ? classroom.name : 'C 程式課堂' }}</h1>
          <p>選擇練習或測驗。每題可獨立作答，進度與程式碼會儲存。</p>
        </div>
        <div v-if="actor" class="board-identity">{{ actor.username }}</div>
      </div>
      <div v-if="classes.length > 1" class="class-picker">
        <span>課堂</span>
        <Select v-model="classSlug" style="width: 240px" @on-change="selectClass">
          <Option v-for="item in classes" :key="item.slug" :value="item.slug">{{ item.name }}</Option>
        </Select>
      </div>
      <div v-if="error" class="login-error" role="alert">{{ error }}</div>
      <div class="board-tabs" role="tablist" aria-label="課堂檢視">
        <button type="button" role="tab" :aria-selected="activeView === 'quizzes'"
                :class="{active: activeView === 'quizzes'}" @click="setView('quizzes')">練習與測驗</button>
        <button type="button" role="tab" :aria-selected="activeView === 'status'"
                :class="{active: activeView === 'status'}" @click="setView('status')">練習動態</button>
        <button type="button" role="tab" :aria-selected="activeView === 'leaderboard'"
                :class="{active: activeView === 'leaderboard'}" @click="setView('leaderboard')">練習排行榜</button>
      </div>
      <div v-if="activeView === 'quizzes'" class="quiz-list-wrap">
        <Table :columns="columns" :data="visibleQuizzes" :loading="working" disabled-hover></Table>
        <div v-if="!working && !visibleQuizzes.length" class="empty">目前沒有開放的練習或測驗。</div>
      </div>
      <div v-else class="social-wrap">
        <div v-if="socialError" class="login-error" role="alert">{{ socialError }}</div>
        <div v-if="socialLoading" class="empty">載入中…</div>
        <table v-else-if="socialEntries.length" class="social-table">
          <thead v-if="activeView === 'leaderboard'"><tr><th>名次</th><th>學生</th><th>分數</th><th>完成題數</th><th>提交次數</th></tr></thead>
          <thead v-else><tr><th>學生</th><th>練習</th><th>題目</th><th>結果</th><th>得分</th><th>時間</th></tr></thead>
          <tbody v-if="activeView === 'leaderboard'">
            <tr v-for="entry in socialEntries" :key="entry.login">
              <td>{{ entry.rank }}</td><td><strong>{{ entry.name }}</strong><small>{{ entry.login }}</small></td>
              <td>{{ entry.score }} / {{ entry.maxScore }}</td><td>{{ entry.solved }}</td><td>{{ entry.attempts }}</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="(entry, index) in socialEntries" :key="entry.login + '-' + entry.at + '-' + index">
              <td><strong>{{ entry.name }}</strong><small>{{ entry.login }}</small></td>
              <td>{{ entry.quizTitle }}</td><td>{{ entry.questionTitle }}</td>
              <td>{{ verdictText(entry.verdict) }}</td><td>{{ entry.earned }} / {{ entry.maxScore }}</td>
              <td>{{ displayTime(entry.at) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="!socialError" class="empty">目前沒有公開的練習紀錄。</div>
        <div v-if="socialTotal > 20" class="social-pager">
          <button type="button" :disabled="socialPage <= 1 || socialLoading" @click="changeSocialPage(-1)">上一頁</button>
          <span>{{ socialPage }} / {{ Math.ceil(socialTotal / 20) }}</span>
          <button type="button" :disabled="socialPage * 20 >= socialTotal || socialLoading" @click="changeSocialPage(1)">下一頁</button>
        </div>
        <p class="social-note">僅顯示已公開的練習成績與狀態；測驗答案及其他學生的程式碼不公開。</p>
      </div>
    </section>
  </div>
</template>

<script>
  import {mapActions} from 'vuex'
  import fcuApi from '@oj/fcuApi'

  function savedTheme () {
    try { return window.localStorage.getItem('fcu-workspace-theme') === 'light' ? 'light' : 'dark' } catch (error) { return 'dark' }
  }

  export default {
    name: 'FcuClassroomHome',
    data () {
      return {
        working: false,
        initialized: false,
        theme: savedTheme(),
        needsLogin: false,
        error: '',
        classes: [],
        classSlug: this.$route.params.classSlug || '',
        classroom: null,
        actor: null,
        quizzes: [],
        scores: {},
        activeView: ['status', 'leaderboard'].includes(this.$route.query.view)
          ? this.$route.query.view : 'quizzes',
        socialPage: 1,
        socialTotal: 0,
        socialEntries: [],
        socialLoading: false,
        socialError: '',
        credentials: {classSlug: this.$route.params.classSlug || '', login: '', password: ''},
        columns: [
          {title: '名稱',
            key: 'title',
            render: (h, params) => h('Button', {
              props: {type: 'text'},
              on: {click: () => this.openQuiz(params.row)},
              style: {fontSize: '15px', paddingLeft: '0', textAlign: 'left'}
            }, params.row.title)},
          {title: '模式',
            width: 110,
            render: (h, params) => h('Tag', {
              props: {color: params.row.mode === 'exam' ? 'orange' : 'blue'}
            }, params.row.mode === 'exam' ? '限時測驗' : '練習')},
          {title: '題數', width: 90, render: (h, params) => h('span', String((params.row.questions || []).length))},
          {title: '我的分數', width: 125, render: (h, params) => h('span', this.scoreText(params.row))},
          {title: '狀態',
            width: 120,
            render: (h, params) => h('Tag', {
              props: {color: params.row.open ? 'green' : 'default'}
            }, params.row.open ? '進行中' : '未開放')}
        ]
      }
    },
    created () { this.load() },
    mounted () { this.syncTheme() },
    beforeDestroy () {
      document.body.classList.remove('fcu-classroom-view', 'fcu-workspace-dark')
    },
    watch: {
      '$route.params.classSlug' (slug) {
        if (slug && slug !== this.classSlug) { this.classSlug = slug; this.loadState() }
      },
      '$route.query.view' (view) {
        const next = ['status', 'leaderboard'].includes(view) ? view : 'quizzes'
        if (next === this.activeView) return
        this.activeView = next
        this.socialPage = 1
        this.socialEntries = []
        this.socialTotal = 0
        if (next !== 'quizzes' && this.classroom) this.loadSocial()
      }
    },
    computed: {
      visibleQuizzes () { return this.quizzes.filter(item => item.published) }
    },
    methods: {
      ...mapActions(['getProfile']),
      async load () {
        this.working = true
        this.error = ''
        try {
          this.classes = await fcuApi.classes()
          this.needsLogin = this.classes.length === 0
          if (!this.classSlug && this.classes.length) this.classSlug = this.classes[0].slug
          if (this.classSlug) await this.loadState()
        } catch (error) {
          this.needsLogin = true
          this.error = ''
        } finally {
          this.working = false
          this.initialized = true
        }
      },
      syncTheme () {
        document.body.classList.add('fcu-classroom-view')
        document.body.classList.toggle('fcu-workspace-dark', this.theme === 'dark')
      },
      toggleTheme () {
        this.theme = this.theme === 'dark' ? 'light' : 'dark'
        try { window.localStorage.setItem('fcu-workspace-theme', this.theme) } catch (error) {}
        this.syncTheme()
      },
      async login () {
        const form = this.credentials
        if (!form.classSlug || !form.login || !form.password) {
          this.error = '請輸入課堂代碼、學號與密碼。'
          return
        }
        this.working = true
        this.error = ''
        try {
          await fcuApi.login(form.classSlug, form.login, form.password)
          form.password = ''
          this.classSlug = form.classSlug
          this.getProfile()
          await this.load()
          this.$router.replace({
            name: 'fcu-classroom',
            params: {classSlug: this.classSlug},
            query: this.activeView === 'quizzes' ? {} : {view: this.activeView}
          })
        } catch (error) {
          form.password = ''
          this.error = error.message || '登入失敗。'
        } finally {
          this.working = false
        }
      },
      async loadState () {
        if (!this.classSlug) return
        this.working = true
        this.error = ''
        try {
          const state = await fcuApi.state(this.classSlug)
          this.actor = state.actor
          this.classroom = state.classroom
          this.quizzes = state.quizzes || []
          this.scores = state.scores || {}
          if (this.activeView !== 'quizzes') await this.loadSocial()
        } catch (error) {
          this.error = error.message || '無法讀取課堂。'
          this.quizzes = []
        } finally {
          this.working = false
        }
      },
      selectClass (slug) {
        this.$router.replace({
          name: 'fcu-classroom',
          params: {classSlug: slug},
          query: this.activeView === 'quizzes' ? {} : {view: this.activeView}
        })
        this.loadState()
      },
      setView (view) {
        if (view === this.activeView) return
        this.activeView = view
        this.socialPage = 1
        this.socialEntries = []
        this.socialTotal = 0
        if (view !== 'quizzes') this.loadSocial()
        this.$router.replace({
          name: 'fcu-classroom',
          params: {classSlug: this.classSlug},
          query: view === 'quizzes' ? {} : {view}
        })
      },
      changeSocialPage (direction) {
        this.socialPage += direction
        this.loadSocial()
      },
      async loadSocial () {
        if (!this.classSlug || this.activeView === 'quizzes') return
        this.socialLoading = true
        this.socialError = ''
        try {
          const result = this.activeView === 'status'
            ? await fcuApi.classPracticeStatus(this.classSlug, this.socialPage)
            : await fcuApi.classPracticeLeaderboard(this.classSlug, this.socialPage)
          this.socialEntries = result.entries || []
          this.socialTotal = result.total || 0
        } catch (error) {
          this.socialEntries = []
          this.socialError = error.message || '無法讀取練習紀錄。'
        } finally {
          this.socialLoading = false
        }
      },
      verdictText (verdict) {
        const labels = {
          '0': '通過',
          '8': '部分通過',
          '-1': '答案錯誤',
          '-2': '編譯錯誤',
          '1': '逾時',
          '2': '逾時',
          '3': '記憶體限制',
          '4': '執行錯誤',
          '5': '系統錯誤',
          '6': '排隊中',
          '7': '評測中',
          'Accepted': '通過',
          'Wrong Answer': '答案錯誤'
        }
        return labels[String(verdict)] || String(verdict)
      },
      displayTime (value) {
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-TW')
      },
      scoreText (quiz) {
        const questions = quiz.questions || []
        const max = questions.reduce((sum, item) => sum + (item.points || 0), 0)
        const earned = questions.reduce((sum, item) => sum + ((this.scores[item.id] || {}).best || 0), 0)
        return `${earned} / ${max}`
      },
      openQuiz (quiz) {
        this.$router.push({name: 'fcu-quiz', params: {classSlug: this.classSlug, quizId: quiz.id}})
      }
    }
  }
</script>

<style lang="less">
  body.fcu-classroom-view .content-app { margin-top: 60px; padding: 0; }
  body.fcu-classroom-view .footer { display: none; }
  .classroom-home {
    --home-canvas: #1b1b1b;
    --home-panel: #262626;
    --home-field: #303030;
    --home-border: #3f3f3f;
    --home-text: #f5f5f5;
    --home-muted: #a9a9a9;
    --home-accent: #2db55d;
    min-height: calc(100vh - 80px);
    padding: 18px 18px 44px;
    color: var(--home-text);
    background: var(--home-canvas);
  }
  .classroom-home.theme-light {
    --home-canvas: #f5f6f8;
    --home-panel: #fff;
    --home-field: #f7f7f8;
    --home-border: #e5e7eb;
    --home-text: #242424;
    --home-muted: #667085;
    --home-accent: #188b45;
  }
  .classroom-home .home-topline { display: flex; justify-content: space-between; align-items: center; max-width: 1120px; margin: 0 auto; font-size: 13px; font-weight: 650; letter-spacing: .02em; }
  .classroom-home .theme-button { border: 1px solid var(--home-border); background: var(--home-panel); color: var(--home-text); border-radius: 7px; padding: 7px 12px; cursor: pointer; font: inherit; }
  .classroom-home .theme-button:hover { border-color: var(--home-accent); }
  .classroom-home .login-card { width: 100%; max-width: 430px; margin: 72px auto 0; padding: 32px; background: var(--home-panel); border: 1px solid var(--home-border); border-radius: 12px; }
  .classroom-home .eyebrow { margin: 0 0 9px; color: var(--home-accent); font-size: 11px; font-weight: 700; letter-spacing: .12em; }
  .classroom-home h1 { margin: 0; color: var(--home-text); font-size: 25px; line-height: 1.3; font-weight: 650; }
  .classroom-home .login-intro { margin: 12px 0 26px; color: var(--home-muted); line-height: 1.6; }
  .classroom-home form { display: flex; flex-direction: column; }
  .classroom-home label { margin: 0 0 7px; font-size: 13px; font-weight: 600; }
  .classroom-home input { width: 100%; height: 41px; margin: 0 0 18px; padding: 0 12px; color: var(--home-text); background: var(--home-field); border: 1px solid var(--home-border); border-radius: 7px; font: inherit; outline: none; }
  .classroom-home input:focus { border-color: var(--home-accent); box-shadow: 0 0 0 2px rgba(45, 181, 93, .15); }
  .classroom-home input::placeholder { color: var(--home-muted); }
  .classroom-home .login-submit { height: 42px; margin-top: 5px; color: #fff; background: var(--home-accent); border: 0; border-radius: 7px; cursor: pointer; font-size: 14px; font-weight: 650; }
  .classroom-home .login-submit:disabled { opacity: .6; cursor: wait; }
  .classroom-home .login-error { margin: 0 0 18px; padding: 10px 12px; color: #f87171; border: 1px solid rgba(248,113,113,.35); border-radius: 7px; background: rgba(248,113,113,.08); }
  .classroom-home .loading-state { margin: 20vh auto; text-align: center; color: var(--home-muted); }
  .classroom-home .classroom-board { margin: 50px auto 0; max-width: 1120px; }
  .classroom-home .board-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin: 0 0 28px; }
  .classroom-home .board-heading p:last-child { margin: 9px 0 0; color: var(--home-muted); }
  .classroom-home .board-identity { padding: 7px 12px; border: 1px solid var(--home-border); border-radius: 7px; color: var(--home-muted); white-space: nowrap; }
  .classroom-home .class-picker { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .classroom-home .quiz-list-wrap { padding: 8px; background: var(--home-panel); border: 1px solid var(--home-border); border-radius: 9px; overflow-x: auto; }
  .classroom-home .board-tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--home-border); margin-bottom: 16px; }
  .classroom-home .board-tabs button { padding: 11px 0; color: var(--home-muted); background: transparent; border: 0; border-bottom: 2px solid transparent; font: inherit; font-weight: 600; cursor: pointer; }
  .classroom-home .board-tabs button.active { color: var(--home-text); border-bottom-color: var(--home-accent); }
  .classroom-home .social-wrap { padding: 8px 0; overflow-x: auto; }
  .classroom-home .social-table { width: 100%; border-collapse: collapse; min-width: 620px; }
  .classroom-home .social-table th { padding: 12px 14px; text-align: left; color: var(--home-muted); font-weight: 600; border-bottom: 1px solid var(--home-border); }
  .classroom-home .social-table td { padding: 13px 14px; border-bottom: 1px solid var(--home-border); }
  .classroom-home .social-table small { display: block; margin-top: 3px; color: var(--home-muted); }
  .classroom-home .social-pager { display: flex; gap: 14px; align-items: center; justify-content: flex-end; margin-top: 16px; }
  .classroom-home .social-pager button { color: var(--home-text); background: var(--home-panel); border: 1px solid var(--home-border); border-radius: 6px; padding: 6px 11px; cursor: pointer; }
  .classroom-home .social-pager button:disabled { opacity: .5; cursor: default; }
  .classroom-home .social-note { margin-top: 18px; color: var(--home-muted); font-size: 12px; }
  .classroom-home .ivu-table, .classroom-home .ivu-table td { color: var(--home-text); background: var(--home-panel); border-color: var(--home-border); }
  .classroom-home .ivu-table th { color: var(--home-muted); background: var(--home-field); border-color: var(--home-border); }
  .classroom-home .ivu-table:before, .classroom-home .ivu-table:after { background: var(--home-border); }
  .classroom-home .ivu-table-row-hover td { background: var(--home-field) !important; }
  .classroom-home .ivu-btn-text { color: var(--home-text); }
  .classroom-home .empty { padding: 30px; color: var(--home-muted); text-align: center; }
  @media (max-width: 620px) {
    .classroom-home .login-card { padding: 25px 21px; margin-top: 42px; }
    .classroom-home .board-heading { flex-direction: column; }
    .classroom-home .classroom-board { margin-top: 32px; }
  }
</style>
