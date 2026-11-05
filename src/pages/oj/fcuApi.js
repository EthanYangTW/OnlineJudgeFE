import axios from 'axios'
import api from '@oj/api'

// Classroom responses use the same {error, data} envelope as the OJ API.
// Keep classroom calls here so the student pages never need judge credentials.
// @oj/api configures the shared Axios base URL as /api.
const root = 'fcu/classroom/'

function request (method, path, data, params) {
  return axios({method, url: root + path, data, params}).then(response => {
    const body = response.data || {}
    if (body.error !== null) {
      throw new Error(typeof body.data === 'string' ? body.data : 'Classroom request failed')
    }
    return body.data
  }).catch(error => {
    const body = error.response && error.response.data
    throw new Error(body && typeof body.data === 'string' ? body.data : (error.message || 'Classroom request failed'))
  })
}

export default {
  login (classSlug, login, password) {
    // QDU's profile GET sets the CSRF cookie needed for this POST.
    return api.getUserInfo().then(() => request('post', 'login/', {class: classSlug, login, password}))
  },
  classes () { return request('get', 'classes/') },
  state (classSlug) { return request('get', `classes/${encodeURIComponent(classSlug)}/state/`) },
  attempts (classSlug, quizId) {
    return request('get', `classes/${encodeURIComponent(classSlug)}/quizzes/${encodeURIComponent(quizId)}/submissions/`)
  },
  draft (classSlug, quizId, questionId) {
    return request('get', `classes/${encodeURIComponent(classSlug)}/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}/draft/`)
  },
  saveDraft (classSlug, quizId, questionId, code) {
    return request('post', `classes/${encodeURIComponent(classSlug)}/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}/draft/`, {code})
  },
  check (classSlug, quizId, questionId, code) {
    return request('post', `classes/${encodeURIComponent(classSlug)}/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}/check/`, {code})
  },
  run (classSlug, quizId, questionId, code, input) {
    return request('post', `classes/${encodeURIComponent(classSlug)}/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}/run/`, {code, input})
  },
  practiceStatus (classSlug, quizId) {
    return request('get', `classes/${encodeURIComponent(classSlug)}/quizzes/${encodeURIComponent(quizId)}/status/`)
  },
  practiceLeaderboard (classSlug, quizId) {
    return request('get', `classes/${encodeURIComponent(classSlug)}/quizzes/${encodeURIComponent(quizId)}/leaderboard/`)
  },
  classPracticeStatus (classSlug, page) {
    return request('get', `classes/${encodeURIComponent(classSlug)}/practice/status/`, undefined, {page, pageSize: 20})
  },
  classPracticeLeaderboard (classSlug, page) {
    return request('get', `classes/${encodeURIComponent(classSlug)}/practice/leaderboard/`, undefined, {page, pageSize: 20})
  },
  submitChoice (classSlug, quizId, questionId, choiceIndex) {
    return request('post', `classes/${encodeURIComponent(classSlug)}/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}/submit/`, {choiceIndex})
  },
  submitCode (quiz, question, code) {
    return api.submitCode({problem_id: question.problemId, contest_id: quiz.contestId, language: 'C', code})
      .then(response => response.data.data)
  },
  problem (quiz, question) {
    return api.getContestProblem(question.problemDisplayId, quiz.contestId)
      .then(response => response.data.data)
  },
  submission (id) { return api.getSubmission(id).then(response => response.data.data) }
}
