const mongoose = require('mongoose')
const { Schema } = mongoose
const Meetup = mongoose.model('Meetup')

const User = new Schema({
  id: { type: String, required: true },
  name: String,
  gender: { type: String, required: true },
  meetup: { type: Schema.Types.ObjectId, ref: 'Meetup' }
})

User.statics.create = async function ({ id, name, gender }) {
  const existringUser = await this.findOne({ id })
  if (existringUser) throw new Error('이미 회원가입을 완료했습니다.')

  const newUser = new this({ id, name, gender })
  return newUser.save()
}

User.statics.fetch = function (id) {
  return this.findOne({ id })
}

User.methods.join = async function (meetup)  {
  this.meetup = meetup._id
  return Promise.all([this.save(), meetup.addUser(this)])
}

User.methods.leave = async function () {
  const meetupId = this.meetup

  if (!meetupId) throw new Error('모임에 등록되어 있지 않습니다.')

  const meetup = await Meetup.findOne({ _id: meetupId })
  this.meetup = undefined
  return Promise.all([this.save(), meetup.removeUser(this)])
}

mongoose.model('User', User).createIndexes({ id: 1 })
