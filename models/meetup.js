const mongoose = require('mongoose')
const { Schema } = mongoose

const Chat = new Schema({
  name: String,
  message: String,
  system: Boolean,
  time: String
})

const Meetup = new Schema({
  name: String,
  place: String,
  users: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  peopleLimit: Number,
  time: String,
  chats: { type: [Chat], default: [] }
})

Meetup.set('toJSON', { virtuals: true })
Meetup.set('toObject', { virtuals: true })

Meetup.statics.create = function (payload) {
  const meetup = new this(payload)
  return meetup.save()
}

Meetup.statics.addChat = async function (_id, chat) {
   await this.updateOne({ _id }, { $push: { chats: chat } })
   return this.findById(_id)
}

Meetup.statics.loadChat = function (_id) {
  return this.findById(_id).then(({ chats }) => chats)
}

Meetup.methods.addUser = async function (user) {
  if (!this.available) {
    throw new Error('인원 초과로 모임에 참가할 수 없습니다.')
  }

  this.users.push(user._id)
  return this.save()
}

Meetup.methods.removeUser = async function (user) {
  this.users = [...this.users].filter(id => !id.equals(user._id))
  // if (this.people <= 0) {
  //   return this.remove()
  // }

  return this.save()
}

Meetup.virtual('people').get(function () {
  return this.users.length
})

Meetup.virtual('available').get(function () {
  return this.people < this.peopleLimit
})

mongoose.model('Meetup', Meetup)
