// @flow
import {set, get} from 'js-cookie';

export const setQuiqChatContainerVisibleCookie = (visible: boolean) => {
  set('quiq-chat-container-visible', visible, {expires: 1});
};
export const setQuiqLauncherVisibleCookie = (visible: boolean) => {
  set('quiq-chat-launcher-visible', visible, {expires: 1});
};

export const getQuiqChatContainerVisibleCookie = () =>
  get('quiq-chat-container-visible') === 'true';
export const getQuiqLauncherVisibleCookie = () => get('quiq-chat-launcher-visible') === 'true';
