'use strict';

const ALARM_NAME = 'ALFRED_ALARM';
const NOTIF_ID = 'ALFRED_NOTIF';

let loginNotifShown = false;
let lastAlarmTime = 0;
let alarmIteration = 0;

// Triggers for the Alfred push service
chrome.runtime.onInstalled.addListener(() => {
  console.log('[chrome.runtime.onInstalled] Starting Alfred!');
  startAlfredService();
});
chrome.runtime.onStartup.addListener(() => {
  console.log('[chrome.runtime.onStartup] Starting Alfred!');
  chrome.alarms.clearAll();
  startAlfredService();
});
chrome.webRequest.onCompleted.addListener(
  // Start at login in Alfred webpage
  (details) => {
    if (details.statusCode === 200) {
      console.log('[chrome.runtime.onCompleted] Starting Alfred!');
      startAlfredService();
    }
  },
  {
    urls: [
      'http://localhost:4200/common/accounts/signin',
      'http://localhost:4200/common/alert_time',
    ],
  }
);

/**
 * Starts the Alfred Push service
 */
function startAlfredService() {
  console.log('[startAlfredService] Start');
  checkSession((hasSession) => {
    if (!hasSession) {
      console.log('[startAlfredService] No session found!');
      // Only show login notification once to be less noisy
      if (!loginNotifShown) {
        // No session, open Alfred page
        showNotification(
          'Alfred',
          'Login to Alfred',
          () => (loginNotifShown = true),
          () => openAlfred()
        );
      }
    } else {
      // Session found
      console.log('[startAlfredService] Session found!');
      getUserInfo((user) => {
        // Find next alert hour
        const now = new Date();
        const alertTimes = user.alert_times.sort((x, y) => x - y);
        let nextAlertIdx = alertTimes.findIndex((t) => t > now.getHours());
        let nextAlertTime;

        // Make a Date object of next alert hour
        const next = new Date();
        next.setMinutes(0);
        next.setSeconds(0);
        next.setMilliseconds(0);
        if (nextAlertIdx === -1) {
          // Next alarm time is tomorrow
          nextAlertTime = alertTimes[0];
          next.setDate(now.getDate() + 1);
        }
        else {
          nextAlertTime = alertTimes[nextAlertIdx];
        }
        next.setHours(nextAlertTime);

        console.log(`[startAlfredService] Creating next alarm`);
        createAlarm(next, () => {
          checkSession((hasSession) => {
            if (hasSession) {
              // Alarm fired and session exists
              console.log(
                `[startAlfredService] Alarm fired and session exists`
              );
              showNotification(
                'Alfred 속보!',
                '구독한 키워드에 대한 새로운 소식이 도착했습니다. 지금 확인하세요!',
                () => {
                  console.log(`[startAlfredService] Starting next cycle`);
                  startAlfredService();
                },
                () => openAlfred()
              );
            }
          });
        });
      });
    }
  });
}

/**
 * Callback function with the user information as parameter
 * @callback getUserInfoCB
 * @param {{email: string; last_name: string; first_name: string; alert_times: number[]}} user
 * @returns {void}
 */
/**
 * Does a GET request of user information
 * @param {getUserInfoCB} callback Function called on response
 */
function getUserInfo(callback) {
  console.log('[getUserInfo] Start');
  const URL = 'http://localhost:8000/common/accounts/user';
  const xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = () => {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
      console.log('[getUserInfo] Callback');
      const response = JSON.parse(xmlHttp.responseText);
      const user = response['user'];
      callback(user);
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
  console.log('[checkSession] Start');
  chrome.cookies.getAll({ name: 'sessionid' }, (cookies) => {
    console.log('[checkSession] Callback');
    callback(cookies.length !== 0);
  });
}

/**
 * Callback function with a Tab instance as parameter
 * @callback tabCreateCB
 * @returns {void}
 */
/**
 * Opens the Alfred web page on a new tab
 * @param {tabCreateCB} callback Called on cookie retreival
 */
function openAlfred() {
  console.log('[openAlfred] Opening alfred');
  const url = 'http://localhost:4200';
  chrome.tabs.create({ url }, (tab) => {});
}

/**
 * Callback function for create event
 * @callback notificationCreateCB
 * @return {void}
 */
/**
 * Callback function for click event
 * @callback notificationClickCB
 * @return {void}
 */
/**
 * Notify user using the Notifications API
 * @param {string} title Notification's title
 * @param {string} message Notification's message
 * @param {notificationCreateCB} onCreate Called when notification is created
 * @param {notificationClickCB} onClick Called when user clicked in a non-button area of the notification
 */
function showNotification(title, message, onCreate, onClick) {
  console.log('[showNotification] Start');
  const options = {
    type: 'basic',
    title,
    message,
    iconUrl: 'images/alfred_w_128.png',
  };
  chrome.notifications.create(NOTIF_ID, options, (nid) => {
    console.log('[showNotification] Notification created');
    onCreate();
    chrome.notifications.onClicked.addListener((nid) => {
      console.log('[showNotification] Notification clicked');
      chrome.notifications.clear(nid);
      onClick();
    });
  });
}

/**
 * Callback function for alarm events
 * @callback alarmFireCB
 * @return {void}
 */
/**
 * Create an alarm
 * @param {Date} time when to fire the alarm
 * @param {alarmFireCB} callback Called when alarm is fired
 */
function createAlarm(time, callback) {
  console.log('[createAlarm] Start');
  chrome.alarms.clearAll((wasCleared) => {
    console.log('[createAlarm] Alarms cleared');
    chrome.alarms.create(ALARM_NAME.concat(alarmIteration++), {
      when: time.getTime(),
    });
    console.log(`[createAlarm] Alarm created to fire at: ${time.toString()}`);
    chrome.alarms.onAlarm.addListener((alarm) => {
      console.log(`[createAlarm] Alarm fired:`, alarm);
      if (alarm.scheduledTime === lastAlarmTime) {
        console.log(`[createAlarm] Ignoring duplicate alarm`);
        return;
      }
      lastAlarmTime = alarm.scheduledTime;
      if (alarm.name.startsWith(ALARM_NAME)) {
        callback();
      }
    });
  });
}
