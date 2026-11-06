<template>
  <div class="classroom-admin">
    <Panel title="FCU Classroom">
      <div class="class-toolbar">
        <el-select v-model="selectedSlug" placeholder="Select class" @change="loadClass">
          <el-option v-for="item in classes" :key="item.slug" :label="item.name" :value="item.slug" />
        </el-select>
        <el-button icon="el-icon-refresh" @click="refresh">Refresh</el-button>
        <el-button v-if="isAdminRole" type="primary" icon="el-icon-plus" @click="createClassVisible = true">New class</el-button>
      </div>
      <p v-if="!classes.length" class="empty-note">{{ isAdminRole ? 'Create a class before importing students or adding quizzes.' : 'No classroom has been assigned to this account.' }}</p>
    </Panel>

    <template v-if="selectedSlug && state">
      <Panel :title="state.classroom.name">
        <el-tabs v-model="activeTab" @tab-click="onTabClick">
          <el-tab-pane label="Quizzes" name="quizzes">
            <div class="section-actions">
              <el-button type="primary" icon="el-icon-plus" @click="newQuizVisible = true">New quiz</el-button>
              <span>Practice and exam quizzes are independent. Students can open any published quiz during its time window.</span>
            </div>
            <el-table :data="state.quizzes" stripe>
              <el-table-column prop="title" label="Quiz" min-width="180" />
              <el-table-column prop="mode" label="Mode" width="110">
                <template slot-scope="scope"><el-tag :type="scope.row.mode === 'exam' ? 'warning' : 'success'">{{ scope.row.mode }}</el-tag></template>
              </el-table-column>
              <el-table-column label="Questions" width="105">
                <template slot-scope="scope">{{ scope.row.questions.length }}</template>
              </el-table-column>
              <el-table-column label="Closes" min-width="180">
                <template slot-scope="scope">{{ formatTime(scope.row.endsAt) }}</template>
              </el-table-column>
              <el-table-column label="Published" width="110">
                <template slot-scope="scope"><el-tag :type="scope.row.published ? 'success' : 'info'">{{ scope.row.published ? 'Yes' : 'No' }}</el-tag></template>
              </el-table-column>
              <el-table-column label="Edit" width="120">
                <template slot-scope="scope"><el-button size="mini" @click="selectQuiz(scope.row)">Open</el-button></template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="Students" name="students">
            <div class="section-actions">
              <el-button type="primary" @click="importVisible = true">Import CSV</el-button>
              <el-switch :value="state.classroom.ipLockEnabled" active-text="One IP per student" @change="changeGlobalLock" />
              <el-button size="small" @click="resetAllIPs">Reset all IP locks</el-button>
            </div>
            <el-table :data="roster" stripe>
              <el-table-column prop="login" label="Student ID" width="150" />
              <el-table-column prop="name" label="Name" min-width="170" />
              <el-table-column prop="class" label="Section" min-width="140" />
              <el-table-column prop="lockedIp" label="Locked IP" min-width="150">
                <template slot-scope="scope">{{ scope.row.lockedIp || 'Not locked' }}</template>
              </el-table-column>
              <el-table-column label="IP rule" width="150">
                <template slot-scope="scope">
                  <el-switch :value="!scope.row.ipLockDisabled" active-text="On" @change="value => changeStudentLock(scope.row, value)" />
                </template>
              </el-table-column>
              <el-table-column label="Action" width="110">
                <template slot-scope="scope"><el-button size="mini" @click="resetStudentIP(scope.row)">Reset IP</el-button></template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane v-if="canManageAssistants" label="Assistants" name="assistants">
            <div class="section-actions">
              <el-button type="primary" icon="el-icon-plus" @click="assistantVisible = true">Add assistant</el-button>
              <span>Assistants can manage this class and review scores. They do not receive global administrator access.</span>
            </div>
            <el-table :data="assistants" stripe>
              <el-table-column prop="login" label="Login" min-width="160" />
              <el-table-column prop="name" label="Name" min-width="180" />
              <el-table-column label="Assigned" min-width="180">
                <template slot-scope="scope">{{ formatTime(scope.row.createdAt) }}</template>
              </el-table-column>
              <el-table-column label="Action" width="110">
                <template slot-scope="scope"><el-button size="mini" @click="removeAssistant(scope.row)">Remove</el-button></template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="Scores" name="scores">
            <div class="section-actions">
              <el-select v-model="scoreQuizId" placeholder="All quizzes" clearable>
                <el-option v-for="quiz in state.quizzes" :key="quiz.id" :value="quiz.id" :label="quiz.title" />
              </el-select>
              <el-button @click="exportScores">Export CSV</el-button>
              <el-button @click="loadClass">Refresh scores</el-button>
              <span>Visible to teachers only. Each question uses the student's best score.</span>
            </div>
            <el-table :data="leaderboard" stripe :default-sort="{prop: 'earned', order: 'descending'}">
              <el-table-column type="index" label="#" width="60" />
              <el-table-column prop="login" label="Student ID" min-width="140" />
              <el-table-column prop="name" label="Name" min-width="140" />
              <el-table-column prop="class" label="Section" min-width="120" />
              <el-table-column prop="earned" label="Score" sortable width="110" />
              <el-table-column prop="maximum" label="Max" width="100" />
              <el-table-column label="Review" width="110">
                <template slot-scope="scope"><el-button size="mini" @click="reviewStudent(scope.row.login)">Code</el-button></template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </Panel>

      <Panel v-if="selectedQuiz" :title="selectedQuiz.title + ' · questions'">
        <div class="section-actions">
          <el-button size="small" type="primary" @click="openNewQuestion">New question</el-button>
          <router-link v-if="canManageAssistants" :to="'/contest/' + selectedQuiz.contestId + '/problem/create'">Create a C problem in this quiz</router-link>
          <el-button size="small" @click="editQuizVisible = true">Quiz settings</el-button>
          <span class="muted">C questions link to a C-only OI problem with scored test cases.</span>
        </div>
        <el-table :data="selectedQuiz.questions" stripe>
          <el-table-column prop="position" label="#" width="65" />
          <el-table-column prop="title" label="Question" min-width="200" />
          <el-table-column prop="kind" label="Type" width="110" />
          <el-table-column prop="points" label="Points" width="90" />
          <el-table-column label="Published" width="110">
            <template slot-scope="scope">{{ scope.row.published ? 'Yes' : 'No' }}</template>
          </el-table-column>
          <el-table-column label="Edit" width="110">
            <template slot-scope="scope"><el-button size="mini" @click="openEditQuestion(scope.row)">Edit</el-button></template>
          </el-table-column>
        </el-table>
      </Panel>
    </template>

    <el-dialog title="New class" :visible.sync="createClassVisible" width="480px">
      <el-form label-position="top">
        <el-form-item label="Class ID"><el-input v-model.trim="newClass.slug" placeholder="fcu-c-2026" /></el-form-item>
        <el-form-item label="Name"><el-input v-model.trim="newClass.name" placeholder="FCU C Classroom" /></el-form-item>
      </el-form>
      <span slot="footer"><el-button @click="createClassVisible = false">Cancel</el-button><el-button type="primary" @click="createClass">Create</el-button></span>
    </el-dialog>

    <el-dialog title="Import student roster" :visible.sync="importVisible" width="650px">
      <p>CSV headers: <code>login,name,class,password</code>. For first-time access, the password may equal the student ID. Importing an existing student resets that student's password and IP lock.</p>
      <input type="file" accept=".csv,text/csv" @change="readRosterFile" />
      <el-input type="textarea" :rows="9" v-model="rosterCsv" placeholder="login,name,class,password" class="roster-input" />
      <p class="muted">Passwords are sent only to the server and stored as hashes. Keep the source CSV private.</p>
      <span slot="footer"><el-button @click="importVisible = false">Cancel</el-button><el-button type="primary" @click="importRoster">Import</el-button></span>
    </el-dialog>

    <el-dialog title="Add class assistant" :visible.sync="assistantVisible" width="540px" @closed="clearAssistantForm">
      <el-form label-position="top" autocomplete="off">
        <el-form-item><el-checkbox v-model="newAssistant.existing">Assign an assistant account already used in another class I own</el-checkbox></el-form-item>
        <el-form-item label="Login"><el-input v-model.trim="newAssistant.login" autocomplete="off" /></el-form-item>
        <template v-if="!newAssistant.existing">
          <el-form-item label="Name"><el-input v-model.trim="newAssistant.name" autocomplete="off" /></el-form-item>
          <el-form-item label="Initial password"><el-input v-model="newAssistant.password" type="password" autocomplete="new-password" /></el-form-item>
          <p class="muted">Use a unique password of at least 12 characters. It is stored as a hash and never shown again.</p>
        </template>
      </el-form>
      <span slot="footer"><el-button @click="assistantVisible = false">Cancel</el-button><el-button type="primary" @click="addAssistant">Add</el-button></span>
    </el-dialog>

    <el-dialog title="New quiz" :visible.sync="newQuizVisible" width="560px">
      <el-form label-position="top">
        <el-form-item label="Quiz ID"><el-input v-model.trim="newQuiz.slug" placeholder="chapter-2-c" /></el-form-item>
        <el-form-item label="Title"><el-input v-model.trim="newQuiz.title" /></el-form-item>
        <el-form-item label="Mode">
          <el-radio-group v-model="newQuiz.mode"><el-radio label="practice">Practice</el-radio><el-radio label="exam">Exam</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="Starts"><el-date-picker v-model="newQuiz.startsAt" type="datetime" placeholder="Now" /></el-form-item>
        <el-form-item label="Closes" v-if="newQuiz.mode === 'exam'"><el-date-picker v-model="newQuiz.endsAt" type="datetime" placeholder="Required for exam" /></el-form-item>
        <el-form-item><el-checkbox v-model="newQuiz.published">Publish to students</el-checkbox></el-form-item>
      </el-form>
      <span slot="footer"><el-button @click="newQuizVisible = false">Cancel</el-button><el-button type="primary" @click="createQuiz">Create</el-button></span>
    </el-dialog>

    <el-dialog title="Quiz settings" :visible.sync="editQuizVisible" width="500px">
      <el-form v-if="selectedQuiz" label-position="top">
        <el-form-item label="Title"><el-input v-model.trim="quizEdit.title" /></el-form-item>
        <el-form-item label="Closes" v-if="selectedQuiz.mode === 'exam'"><el-date-picker v-model="quizEdit.endsAt" type="datetime" /></el-form-item>
        <el-form-item><el-checkbox v-model="quizEdit.published">Published</el-checkbox></el-form-item>
      </el-form>
      <span slot="footer"><el-button @click="editQuizVisible = false">Cancel</el-button><el-button type="primary" @click="saveQuiz">Save</el-button></span>
    </el-dialog>

    <el-dialog :title="questionEditId ? 'Edit question' : 'New question'" :visible.sync="questionVisible" width="700px">
      <el-form label-position="top">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="Question ID"><el-input v-model.trim="questionForm.slug" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="Type">
            <el-select v-model="questionForm.kind" :disabled="!!questionEditId"><el-option label="Multiple choice" value="mcq" /><el-option label="C lab" value="c_lab" /></el-select>
          </el-form-item></el-col>
        </el-row>
        <el-form-item label="Title"><el-input v-model.trim="questionForm.title" /></el-form-item>
        <el-form-item label="Prompt"><el-input type="textarea" :rows="5" v-model="questionForm.prompt" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="Points"><el-input-number v-model="questionForm.points" :min="1" :max="1000" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="Order"><el-input-number v-model="questionForm.position" :min="0" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="Visibility"><el-checkbox v-model="questionForm.published">Published</el-checkbox></el-form-item></el-col>
        </el-row>
        <template v-if="questionForm.kind === 'mcq'">
          <el-form-item label="Choices (one per line)"><el-input type="textarea" :rows="5" v-model="choicesText" /></el-form-item>
          <el-form-item label="Correct choice, starting at 1"><el-input-number v-model="answerNumber" :min="1" :max="8" /></el-form-item>
        </template>
        <el-form-item v-else label="QDU C problem numeric ID (not Display ID)"><el-input-number v-model="questionForm.problemId" :min="1" /></el-form-item>
      </el-form>
      <p class="muted">Question content is frozen after a student submits it. Create a new ID for a changed grading rule.</p>
      <span slot="footer"><el-button @click="questionVisible = false">Cancel</el-button><el-button type="primary" @click="saveQuestion">Save</el-button></span>
    </el-dialog>

    <el-dialog :title="reviewLogin ? 'Submissions · ' + reviewLogin : 'Submissions'" :visible.sync="reviewVisible" width="760px">
      <el-select v-model="reviewQuizId" placeholder="Select quiz" @change="loadSubmissions">
        <el-option v-for="quiz in state ? state.quizzes : []" :key="quiz.id" :value="quiz.id" :label="quiz.title" />
      </el-select>
      <el-table :data="reviewRows" stripe>
        <el-table-column prop="at" label="Submitted" min-width="180"><template slot-scope="scope">{{ formatTime(scope.row.at) }}</template></el-table-column>
        <el-table-column prop="verdict" label="Verdict" min-width="130" />
        <el-table-column label="Score" width="100"><template slot-scope="scope">{{ scope.row.earned }} / {{ scope.row.max }}</template></el-table-column>
        <el-table-column label="Code" width="90"><template slot-scope="scope"><el-button v-if="scope.row.code" size="mini" @click="reviewCode = scope.row.code">View</el-button></template></el-table-column>
      </el-table>
      <pre v-if="reviewCode" class="code-review">{{ reviewCode }}</pre>
    </el-dialog>
  </div>
</template>

<script>
import api from '../../api'
import {mapGetters} from 'vuex'

const blankQuestion = () => ({slug: '',
  title: '',
  kind: 'mcq',
  prompt: '',
  points: 5,
  position: 0,
  published: true,
  choices: ['', '', '', ''],
  answerIndex: 0,
  problemId: null})

export default {
  name: 'Classroom',
  data () {
    return {
      classes: [],
      selectedSlug: '',
      state: null,
      roster: [],
      assistants: [],
      scoreRows: [],
      activeTab: 'quizzes',
      selectedQuizId: null,
      scoreQuizId: null,
      createClassVisible: false,
      importVisible: false,
      assistantVisible: false,
      newQuizVisible: false,
      editQuizVisible: false,
      questionVisible: false,
      reviewVisible: false,
      newClass: {slug: '', name: ''},
      rosterCsv: '',
      newAssistant: {login: '', name: '', password: '', existing: false},
      newQuiz: {slug: '', title: '', mode: 'practice', startsAt: null, endsAt: null, published: false},
      quizEdit: {title: '', endsAt: null, published: false},
      questionForm: blankQuestion(),
      questionEditId: null,
      choicesText: '',
      answerNumber: 1,
      reviewLogin: '',
      reviewQuizId: null,
      reviewRows: [],
      reviewCode: ''
    }
  },
  computed: {
    ...mapGetters(['isAdminRole']),
    canManageAssistants () {
      return this.state && this.state.classroom.role === 'owner'
    },
    selectedQuiz () {
      return this.state && this.state.quizzes.find(q => q.id === this.selectedQuizId)
    },
    leaderboard () {
      if (!this.state) return []
      const questions = this.state.quizzes.filter(q => !this.scoreQuizId || q.id === this.scoreQuizId)
        .reduce((all, quiz) => all.concat(quiz.questions), [])
      return this.scoreRows.map(row => ({...row,
        earned: questions.reduce((sum, q) => sum + ((row.scores[String(q.id)] || {}).best || 0), 0),
        maximum: questions.reduce((sum, q) => sum + q.points, 0)
      })).sort((a, b) => b.earned - a.earned || a.login.localeCompare(b.login))
    }
  },
  mounted () {
    this.refresh()
  },
  methods: {
    onTabClick (tab) {
      if (tab.name === 'scores') this.loadClass()
    },
    formatTime (value) {
      return value ? new Date(value).toLocaleString() : 'No deadline'
    },
    refresh () {
      api.getClassrooms().then(res => {
        this.classes = res.data.data
        if (!this.selectedSlug && this.classes.length) this.selectedSlug = this.classes[0].slug
        if (this.selectedSlug) this.loadClass()
      }).catch(() => {})
    },
    loadClass () {
      if (!this.selectedSlug) return
      Promise.all([api.getClassroomState(this.selectedSlug), api.getClassroomRoster(this.selectedSlug),
        api.getClassroomScores(this.selectedSlug)]).then(([state, roster, scores]) => {
          this.state = state.data.data
          this.roster = roster.data.data
          this.scoreRows = scores.data.data
          if (this.canManageAssistants) this.loadAssistants()
          else this.assistants = []
          if (!this.state.quizzes.some(q => q.id === this.selectedQuizId)) this.selectedQuizId = null
        }).catch(() => {})
    },
    loadAssistants () {
      api.getClassroomAssistants(this.selectedSlug).then(res => { this.assistants = res.data.data }).catch(() => {})
    },
    clearAssistantForm () {
      this.newAssistant = {login: '', name: '', password: '', existing: false}
    },
    addAssistant () {
      const data = this.newAssistant.existing
        ? {login: this.newAssistant.login, existing: true}
        : {login: this.newAssistant.login, name: this.newAssistant.name, password: this.newAssistant.password}
      api.addClassroomAssistant(this.selectedSlug, data).then(() => {
        this.clearAssistantForm()
        this.assistantVisible = false
        this.loadAssistants()
      }).catch(() => {})
    },
    removeAssistant (row) {
      this.$confirm('Remove this assistant from the selected class?', 'Remove assistant', {type: 'warning'})
        .then(() => api.removeClassroomAssistant(this.selectedSlug, row.login))
        .then(() => this.loadAssistants()).catch(() => {})
    },
    createClass () {
      api.createClassroom(this.newClass).then(res => {
        this.createClassVisible = false
        this.selectedSlug = res.data.data.slug
        this.newClass = {slug: '', name: ''}
        this.refresh()
      }).catch(() => {})
    },
    readRosterFile (event) {
      const file = event.target.files && event.target.files[0]
      if (!file) return
      if (file.size > 262144) return this.$error('CSV must be at most 256 KiB')
      const reader = new window.FileReader()
      reader.onload = () => { this.rosterCsv = String(reader.result || '') }
      reader.readAsText(file, 'UTF-8')
    },
    importRoster () {
      api.importClassroomRoster(this.selectedSlug, this.rosterCsv).then(() => {
        this.importVisible = false
        this.rosterCsv = ''
        this.loadClass()
      }).catch(() => {})
    },
    changeGlobalLock (enabled) {
      api.setClassroomIPLock(this.selectedSlug, {action: 'set-global', enabled}).then(() => this.loadClass()).catch(() => {})
    },
    changeStudentLock (row, enabled) {
      api.setClassroomIPLock(this.selectedSlug, {action: 'set-student', login: row.login, disabled: !enabled})
        .then(() => this.loadClass()).catch(() => {})
    },
    resetStudentIP (row) {
      api.setClassroomIPLock(this.selectedSlug, {action: 'reset-student', login: row.login})
        .then(() => this.loadClass()).catch(() => {})
    },
    resetAllIPs () {
      this.$confirm('Reset every student IP lock and sign out student sessions?', 'Reset all IPs', {type: 'warning'})
        .then(() => api.setClassroomIPLock(this.selectedSlug, {action: 'reset-all'}))
        .then(() => this.loadClass()).catch(() => {})
    },
    createQuiz () {
      const data = {...this.newQuiz}
      data.startsAt = data.startsAt ? data.startsAt.toISOString() : undefined
      data.endsAt = data.endsAt ? data.endsAt.toISOString() : undefined
      api.createClassroomQuiz(this.selectedSlug, data).then(res => {
        this.newQuizVisible = false
        this.newQuiz = {slug: '', title: '', mode: 'practice', startsAt: null, endsAt: null, published: false}
        this.selectedQuizId = res.data.data.id
        this.loadClass()
      }).catch(() => {})
    },
    selectQuiz (quiz) {
      this.selectedQuizId = quiz.id
      this.quizEdit = {title: quiz.title,
        published: quiz.published,
        endsAt: quiz.endsAt ? new Date(quiz.endsAt) : null}
    },
    saveQuiz () {
      const data = {...this.quizEdit, endsAt: this.quizEdit.endsAt ? this.quizEdit.endsAt.toISOString() : null}
      api.updateClassroomQuiz(this.selectedSlug, this.selectedQuizId, data).then(() => {
        this.editQuizVisible = false
        this.loadClass()
      }).catch(() => {})
    },
    openNewQuestion () {
      this.questionEditId = null
      this.questionForm = blankQuestion()
      this.choicesText = '\n\n\n'
      this.answerNumber = 1
      this.questionVisible = true
    },
    openEditQuestion (question) {
      this.questionEditId = question.id
      this.questionForm = {...question}
      this.choicesText = (question.choices || []).join('\n')
      this.answerNumber = (question.answerIndex || 0) + 1
      this.questionVisible = true
    },
    saveQuestion () {
      const data = {...this.questionForm}
      if (data.kind === 'mcq') {
        data.choices = this.choicesText.split('\n').map(item => item.trim()).filter(Boolean)
        data.answerIndex = this.answerNumber - 1
      }
      const action = this.questionEditId
        ? api.updateClassroomQuestion(this.selectedSlug, this.selectedQuizId, this.questionEditId, data)
        : api.createClassroomQuestion(this.selectedSlug, this.selectedQuizId, data)
      action.then(() => {
        this.questionVisible = false
        this.loadClass()
      }).catch(() => {})
    },
    reviewStudent (login) {
      this.reviewLogin = login
      this.reviewQuizId = this.scoreQuizId || (this.state.quizzes[0] && this.state.quizzes[0].id)
      this.reviewRows = []
      this.reviewCode = ''
      this.reviewVisible = true
      this.loadSubmissions()
    },
    loadSubmissions () {
      if (!this.reviewQuizId) return
      this.reviewCode = ''
      api.getClassroomSubmissions(this.selectedSlug, this.reviewQuizId, this.reviewLogin)
        .then(res => { this.reviewRows = res.data.data }).catch(() => {})
    },
    exportScores () {
      const cell = value => '"' + String(value == null ? '' : value).replace(/^\s*([=+@-])/, "'$1").replace(/"/g, '""') + '"'
      const lines = [['class', 'student_id', 'name', 'earned', 'maximum'],
        ...this.leaderboard.map(row => [row.class, row.login, row.name, row.earned, row.maximum])]
      const csv = '\uFEFF' + lines.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
      const url = window.URL.createObjectURL(new window.Blob([csv], {type: 'text/csv;charset=utf-8'}))
      const link = document.createElement('a')
      link.href = url
      link.download = this.selectedSlug + '-scores.csv'
      link.click()
      window.URL.revokeObjectURL(url)
    }
  }
}
</script>

<style scoped lang="less">
.class-toolbar, .section-actions { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.section-actions span { color: #777; }
.empty-note, .muted { color: #777; }
.roster-input { margin-top: 16px; }
.code-review { max-height: 360px; overflow: auto; padding: 16px; background: #f5f7fa; }
</style>
