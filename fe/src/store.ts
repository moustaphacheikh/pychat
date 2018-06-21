import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import {ActionContext} from 'vuex/types';

Vue.use(Vuex);

import loggerFactory from './utils/loggerFactory';
import {
  CurrentUserInfo,
  EditingMessage,
  GrowlModel,
  GrowlType,
  MessageModel,
  RoomModel,
  RootState,
  UserModel
} from './model';
import {MessageLocation, UserModelId, SetRoomSettings} from './types';

interface State extends ActionContext<RootState, RootState> {}

const logger = loggerFactory.getLogger('CHAT', 'color: #0FFF00; font-weight: bold');

const store: StoreOptions<RootState> = {
  state: {
    isOnline: true,
    growls: [],
    allUsers: {},
    regHeader: null,
    rooms: {},
    activeUserId: null,
    userInfo: null,
    online: [],
    activeRoomId: null,
    editedMessage: null,
  },
  getters: {
    privateRooms(state): { [id: string]: UserModelId } {
      let res =  Object.keys(state.rooms)
          .filter(key => !state.rooms[key].name)
          .reduce((obj, key) => {
            let users = state.rooms[key].users;
            let id = state.userInfo.userId === users[0] ? users[1] : users[0];
            return {
              ...obj,
              [key]: {...state.allUsers[id], id}
            };
          }, {}) as { [id: string]: UserModelId };
      logger.log('private rooms {}', res)();
      return res;
    },
    publicRooms(state): { [id: string]: RoomModel } {
      let res =  Object.keys(state.rooms)
          .filter(key => state.rooms[key].name)
          .reduce((obj, key) => {
            return {
              ...obj,
              [key]: state.rooms[key]
            };
          }, {});
      logger.log('public rooms {}', res)();
      return res;
    },
    maxId(state): SingleParamCB<number> {
      return id => state.rooms[id].messages.length > 0 ? state.rooms[id].messages[0].id : null;
    },
    activeRoom(state): RoomModel {
      return state.rooms[state.activeRoomId];
    },
    minId(state): SingleParamCB<number> {
      return id => state.rooms[id].messages.length > 0 ? state.rooms[id].messages[this.room.messages.length - 1].id : null;
    },
    activeUser(state): UserModel {
      return state.allUsers[state.activeUserId];
    },
    showNav(state) {
      return !state.editedMessage && !state.activeUserId;
    },
    editingMessageModel(state): MessageModel {
      if (state.editedMessage) {
        logger.log('Eval editingMessageModel')();
        return state.rooms[state.editedMessage.roomId].messages.find(m => m.id === state.editedMessage.messageId);
      } else {
        return null;
      }
    }
  },
  mutations: {
    setEditedMessage(state: RootState, editedMessage: EditingMessage) {
      state.editedMessage = editedMessage;
      state.activeUserId = null;
    },
    setActiveUserId(state: RootState, activeUserId: number) {
      state.activeUserId = activeUserId;
      state.editedMessage = null;
    },
    setMessages(state: RootState, {messages, roomId}) {
      state.rooms[roomId].messages = messages;
    },
    setRoomSettings(state: RootState, srm: SetRoomSettings) {
      let room = state.rooms[srm.roomId];
      room.notifications = srm.settings.notifications;
      room.volume = srm.settings.volume;
      room.name = srm.settings.name;
    },
    deleteRoom(state: RootState, roomId: number) {
      let room = state.rooms[roomId];
      if (state.rooms[roomId]) {
        let a = 'delete'; // TODO
        Vue[a](state.rooms, roomId);
      } else {
        logger.error('Unable to find room {} to delete', roomId)();
      }
    },
    setRoomsUsers(state: RootState, {roomId, users}) {
      if (state.rooms[roomId]) {
        state.rooms[roomId].users = users;
      } else {
        logger.error('Unable to find room {} to kick user', roomId)();
      }
    },
    addMessage(state: RootState, rm: MessageModel) {
      let r: RoomModel = state.rooms[rm.roomId];
      if (r.messages.find(m => m.id === rm.id)) {
        logger.log('Skipping printing message {}, because it\'s already in list', rm)();
      } else {
        logger.log('Adding message to storage {}', rm)();
        let room = state.rooms[rm.roomId];
        let i = 0;
        for (; i < room.messages.length; i++) {
          if (room.messages[i].time > rm.time) {
            break;
          }
        }
        room.messages.splice(i, 0, rm);
      }
    },
    deleteMessage(state: RootState, rm: MessageLocation) {
      let room = state.rooms[rm.roomId];
      let m: MessageModel = room.messages.find(m => m.id === rm.id);
      if (m) {
        logger.log('Removing message {} ', rm.id)();
        m.deleted = true;
        m.content = null;
        m.files = null;
      } else {
        logger.log('Unable to find message {} to remove it', rm.id)();
      }
    },
    editMessage(state: RootState, rm: MessageModel) {
      let room = state.rooms[rm.roomId];
      let i: number = room.messages.findIndex(m => m.id === rm.id);
      if (i >= 0) {
        logger.log('Editing message {} , index is {}', rm.id, i)();
        room.messages.splice(i, 1, rm);
      } else {
        logger.log('Unable to find message {} to edit it', rm.id)();
      }
    },
    setIsOnline(state: RootState, isOnline: boolean) {
      state.isOnline = isOnline;
    },
    addGrowl(state: RootState, growlModel: GrowlModel) {
      state.growls.push(growlModel);
    },
    removeGrowl(state: RootState, growlModel: GrowlModel) {
      let index = state.growls.indexOf(growlModel, 0);
      if (index > -1) {
        state.growls.splice(index, 1);
      }
    },
    setActiveRoomId(state: RootState, id: number) {
      state.activeRoomId = id;
    },
    setRegHeader(state: RootState, regHeader: string) {
      state.regHeader = regHeader;
    },
    addUser(state: RootState, {userId, user, sex}) {
      state.allUsers[userId] = {sex, user};
    },
    setOnline(state: RootState, ids: number[]) {
      state.online = ids;
    },
    setUsers(state: RootState, users: { [id: number]: UserModel }) {
      state.allUsers = users;
    },
    setUserInfo(state: RootState, userInfo: CurrentUserInfo) {
      state.userInfo = userInfo;
    },
    setRooms(state: RootState, rooms: {[id: string]: RoomModel}) {
      state.rooms = rooms;
    },
    setAllLoaded(state: RootState, roomId: number) {
      state.rooms[roomId].allLoaded = true;
    }
  },
  actions: {
    growlError(context: State, title) {
      let growl: GrowlModel = {id: Date.now(), title, type: GrowlType.ERROR};
      context.commit('addGrowl', growl);
      setTimeout(f => {
        context.commit('removeGrowl', growl);
      }, 4000);
    },
    growlInfo(context: State, title) {
      let growl: GrowlModel = {id: Date.now(), title, type: GrowlType.INFO};
      context.commit('addGrowl', growl);
      setTimeout(f => {
        context.commit('removeGrowl', growl);
      }, 4000);
    },
    growlSuccess(context: State, title) {
      let growl: GrowlModel = {id: Date.now(), title, type: GrowlType.SUCCESS};
      context.commit('addGrowl', growl);
      setTimeout(f => {
        context.commit('removeGrowl', growl);
      }, 4000);
    },
    logout(context: State) {
      context.commit('setUserInfo', null);
      context.commit('setEditedMessage', null);
      context.commit('setRooms', {});
    }
  },
};


export default new Vuex.Store<RootState>(store);