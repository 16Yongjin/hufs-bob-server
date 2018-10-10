const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const expressJwt = require('express-jwt')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const { login, getUserGender, randomAnimalName, formatTime } = require('./utils')

require('./models/meetup')
require('./models/user')

const Meetup = mongoose.model('Meetup')
const User = mongoose.model('User')
const { secret, tokenOptions, mongodbUri } = require('./config')
const issueToken = user => new Promise((resolve, reject) => jwt.sign(user.toJSON(), secret, tokenOptions, (e, t) => e ? reject(e) : resolve(t)))

const success = true
const signUpRequired = true

const app = express()
const port = process.env.PORT || 3000 
app.use(bodyParser.json())
app.use(cors())
app.use(expressJwt({ secret }).unless({path: ['/login', '/signup']}));

const server = app.listen(port, () =>
  console.log(`Server is runnning on Port ${port}`)
)

const io = require('socket.io')(server)

app.post('/login', async (req, res) => {
  try {

    const { id, password } = req.body
    const loginSuccess = await login(id, password)
    if (!loginSuccess) return res.send({ message: '학번 또는 비밀번호를 제대로 입력해주세요.' })

    const existingUser = await User.fetch(id)
    if (!existingUser) return res.send({ message: '약관에 동의해주세요.', signUpRequired })

    console.log(existingUser)
    const token = await issueToken(existingUser)
    return res.send({ message: '로그인에 성공했습니다.', success, token })

  } catch ({ message, stack }) {
    console.log(stack)
    res.send({ message })
  }
})

app.post('/signup', async (req, res) => {
  try {
    const { id, password } = req.body
    const cookie = await login(id, password)
    if (!cookie) return res.send({ message: '학번 또는 비밀번호를 제대로 입력해주세요.' })

    const name = randomAnimalName()
    const gender = await getUserGender(cookie)
    const newUser = await User.create({ id, name, gender })
    const token = await issueToken(newUser)
    res.send({ message: '회원가입에 성공했습니다.', success, token })
  } catch ({ message, stack }) {
    console.log(stack)
    res.send({ message })
  }
})



app.get('/meetups', async (req, res) => {
  try {
    const userId = req.user.id
    const user = await User.fetch(userId).populate({ path: 'meetup', model: 'Meetup' })

    if (!user) return res.send({ message: '잘못된 요청입니다.' })

    const { name, meetup } = user
    if (meetup) res.send({ success, meetup, meetups: [], name })
    else res.send({ success, meetups: (await Meetup.find()).map(m => _.omit(m.toObject(), ['users', 'chats'])), meetup: null, name })

  } catch ({ message, stack }) {
    console.log(stack)
    res.send({ message })
  }
})

app.post('/meetups/create', async (req, res) => {
  try {

    const userId = req.user.id
    const meetupData = req.body
    console.log('meetupData', meetupData)
    const [user, meetup] = await Promise.all([User.fetch(userId), Meetup.create(meetupData)])    
    const [updatedUser, updatedMeetup] = await user.join(meetup)
    const meetupId = updatedMeetup._id

    const systemMessage = { message: `${updatedUser.name}님이 모임을 만들었습니다.`, system: true }
    await Meetup.addChat(meetupId, systemMessage)
    io.to(meetupId).emit('MESSAGE', systemMessage)

    const token = await issueToken(updatedUser)
    res.send({ message: '모임 생성에 성공했습니다.', success, token, meetup: updatedMeetup, meetups: [] })

  } catch ({ message, stack }) {
    console.log(stack)
    res.send({ message })
  }
})




// Join Meetup
app.post('/meetups/join', async (req, res) => {
  try {

    const userId = req.user.id
    const meetupId = req.body.meetupId

    const [user, meetup] = await Promise.all([User.fetch(userId), Meetup.findOne({ _id: meetupId })])
    const [updatedUser, updatedMeetup] = await user.join(meetup)

    const systemMessage = { message: `${updatedUser.name}님이 모임에 들어왔습니다.`, system: true }
    await Meetup.addChat(meetupId, systemMessage)
    io.to(meetupId).emit('MESSAGE', systemMessage)

    const { people } = updatedMeetup
    io.to(meetupId).emit('UPDATE_MEETUP', { people })

    res.send({ message: '모임에 들어갔습니다.', meetup: await Meetup.findOne({ _id: meetupId }), meetups: [] })

  } catch ({ message, stack }) {
    console.log(stack)
    res.send({ message })
  }
})

app.post('/meetups/leave', async (req, res) => {
  try {

    const userId = req.user.id
    const user = await User.fetch(userId)
    const [updatedUser, updatedMeetup] = await user.leave()

    const token = await issueToken(updatedUser)

    const systemMessage = { message: `${updatedUser.name}님이 모임에서 나갔습니다.`, system: true }
    io.to(updatedMeetup._id).emit('MESSAGE', systemMessage)
    await Meetup.addChat(updatedMeetup._id, systemMessage)

    const { people } = updatedMeetup
    io.to(updatedMeetup._id).emit('UPDATE_MEETUP', { people })

    res.send({ message: '모임에서 나갔습니다.', token, meetups: await Meetup.find(), meetup: null })
  } catch ({ message, stack }) {
    console.log(stack)
    res.send({ message })
  }
})

// 회원 탈퇴
// 가입된 모임에서 나가기
// 회원 정보 삭제
app.post('/meetups/withdraw', async (req, res) => {})

io.on('connection', socket => {
  console.log(socket.id)

  socket.on('SEND_MESSAGE', async ({ meetupId, chat }) => {
    chat = { ...chat, time: formatTime(new Date()) }
    console.log(chat)
    await Meetup.addChat(meetupId, chat)
    io.to(meetupId).emit('MESSAGE', chat)
  })

  socket.on('JOIN_CHAT', (meetupId) => {
    socket.join(meetupId)
  })

  socket.on('disconnect', () => {
    console.log('Got disconnect!')
    console.log(socket.id)
 })
})

mongoose.connect(mongodbUri, { useNewUrlParser: true })
const db = mongoose.connection
db.on('error', console.error)
db.once('open', ()=>{
    console.log('connected to mongodb server')
})
