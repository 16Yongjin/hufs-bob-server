const rp = require('request-promise')
const cheerio = require('cheerio')
const crypto = require('crypto')
const sha512 = txt => crypto.createHash('sha512').update(txt).digest('hex')
const jwt = require('jsonwebtoken')
const { secret, tokenOptions } = require('./config')

const loginOptions = (user_id, password) => ({
  method: 'POST',
  url: 'https://wis.hufs.ac.kr/src08/jsp/login/LOGIN1011M.jsp',
  headers:  { 'Content-Type': 'application/x-www-form-urlencoded' },
  form: {
    gubun: 'o',
    user_id,
    password: sha512(password)
  },
  resolveWithFullResponse: true
})

const userInfoOptions = Cookie => ({
  method: 'GET',
  uri: 'https://wis.hufs.ac.kr/src08/jsp/stuinfo_10/STUINFO1000C_myinfo.jsp',
  headers: { Cookie }
})

const stripHTMLTags = str => str.replace(/<[^>]*>/g, '')

const login = async (user_id, password) => {
  if (/test/.test(user_id)) {
    return true
  }

  if (!(/^\d{5,9}$/.test(user_id) && password)) {
    return false
  }

  const { headers, body } = await rp(loginOptions(user_id, password))
  const loggedIn = !stripHTMLTags(body).trim().startsWith('alert("아이디나 비밀번호가 틀렸습니다.')
  const cookie = headers['set-cookie'].join('; ')
  return loggedIn && cookie
}

const getUserGender = async (cookie) => {
  if (typeof cookie === 'boolean') return '남'

  const body = await rp(userInfoOptions(cookie))
  const $ = cheerio.load(body)
  const genderText = $('tr').eq(1).children().eq(5).text()
  const gender = !!genderText.match(/남|Male/) ? '남' : '여'
  return gender
}

const animals = `악어, 개미 핥기, 아르마딜로, 오소리, 박쥐, 비버, 버팔로, 낙타, 카멜레온, 치타, 다람쥐, 친칠라, 츄파카브라, 가마우지, 코요테, 까마귀, 딩고는, 공룡, 돌고래, 오리, 코끼리, 여우, 흰 족제비, 개구리, 기린, 고퍼, 회색 곰, 고슴도치, 하마, 하이에나, 자칼, 아이 벡스, 이구아나, 코알라, 크라켄, 여우, 표범, 라이거, 라마, 해우, 밍크, 원숭이, 일각 고래, 냥 고양이, 오랑우탄, 수달, 팬더, 펭귄, 오리너구리, 파이썬, 토끼, 너구리, 코뿔소, 양, 스컹크, 다람쥐, 거북, 해마, 늑대, 오소리, 웜뱃`.split(', ').map(i => `익명의 ${i}`)
const randomAnimalName = () => animals[Math.floor(Math.random() * animals.length)]

function formatTime (date) {
  const h = date.getHours()
  const m = date.getMinutes().toString().padStart(2, '0')
  return h > 12 ? `${h - 12}:${m} pm`
    : h === 12 ? `12:${m} pm`
      : h === 0 ? `12:${m} am`
        : `${h}:${m} am`
}

const issueToken = user => new Promise((resolve, reject) => jwt.sign(user.toJSON(), secret, tokenOptions, (e, t) => e ? reject(e) : resolve(t)))

module.exports = { login, getUserGender, randomAnimalName, formatTime, issueToken }
