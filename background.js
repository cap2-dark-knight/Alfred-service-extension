'use strict';

// Triggers for the Alfred push service
chrome.runtime.onInstalled.addListener(startAlfredService);
chrome.runtime.onStartup.addListener(startAlfredService);
chrome.webRequest.onResponseStarted.addListener(
  (details) => {
    if (details.statusCode === 200) {
      startAlfredService();
    }
  },
  {
    urls: ['http://localhost:4200/common/accounts/signin'],
  }
);

/**
 * Starts the Alfred Push service
 */
function startAlfredService() {
  checkSession((hasSession) => {
    if (!hasSession) {
      // No session, open Alfred page
      showNotification('Alfred', 'Login to Alfred', (nid) => {
        openAlfred((tab) => {
          console.log('Alfred!');
        });
      });
    } else {
      // Session found
      getUserInfo((user) =>
        showNotification(
          'Welcome to Alfred',
          `Hi ${user.first_name}!`,
          (nid) => {}
        )
      );
    }
  });
}

/**
 * Callback function with the user information as parameter
 * @callback getUserInfoCB
 * @param {{email: string; last_name: string; first_name: string; data_period: number}} user
 * @returns {void}
 */
/**
 * Does a GET request of user information
 * @param {getUserInfoCB} callback Function called on response
 */
function getUserInfo(callback) {
  const URL = 'http://localhost:8000/common/accounts/user';
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = () => {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
      const response = JSON.parse(xmlHttp.responseText);
      const user = response['user'];
      callback(user);
      console.log(user);
    }
  };
  xmlHttp.open('GET', URL, true);
  xmlHttp.send();
}

/**
 * Callback function with a boolean value of the existence of session
 * @callback checkSessionCB
 * @param {boolean} hasSession
 * @returns {void}
 */
/**
 * Checks whether session is established
 * @param {checkSessionCB} callback Called on cookie retreival
 */
function checkSession(callback) {
  chrome.cookies.getAll({ name: 'sessionid' }, (cookies) =>
    callback(cookies.length !== 0)
  );
}

/**
 * Tab type - Check {@link https://developer.chrome.com/extensions/tabs#type-Tab|here}
 * @typedef Tab
 * @type {object}
 */
/**
 * Callback function with a Tab instance as parameter
 * @callback tabCreateCB
 * @param {Tab} tab
 * @returns {void}
 */
/**
 * Opens the Alfred web page on a new tab
 * @param {tabCreateCB} callback Called on cookie retreival
 */
function openAlfred(callback) {
  const url = 'http://localhost:4200';
  chrome.tabs.create({ url }, callback);
}

/**
 * Callback function with notification ID as parameter
 * @callback notificationClickCB
 * @param {string} notificationId
 * @return {void}
 */
/**
 * Notify user using the Notifications API
 * @param {string} title Notification's title
 * @param {string} message Notification's message
 * @param {notificationClickCB} onClick Called when user clicked in a non-button area of the notification
 */
function showNotification(title, message, onClick) {
  let id;
  const options = {
    type: 'basic',
    title,
    message,
    iconUrl: 'images/alfred_w_128.png',
  };
  chrome.notifications.create(id, options, (nid) => {
    id = nid;
    chrome.notifications.onClicked.addListener(onClick);
  });
}
