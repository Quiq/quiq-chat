// @flow
import {set, get} from 'js-cookie';

export const setQuiqChatContainerVisibleCookie = (visible: boolean) => {
  set('quiq-chat-container-visible', visible, {expires: 1});
};
export const setQuiqUserTakenMeaningfulActionCookie = (visible: boolean) => {
  set('quiq-user-taken-meaningful-action', visible, {expires: 1});
};

export const getQuiqChatContainerVisibleCookie = () =>
  get('quiq-chat-container-visible') === 'true';
export const getQuiqUserTakenMeaningfulActionCookie = () =>
  get('quiq-user-taken-meaningful-action') === 'true';
