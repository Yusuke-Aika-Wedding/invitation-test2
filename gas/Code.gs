/**
 * Yusuke & Aika Wedding Invitation Backend
 *
 * GitHub Pages から JSONP で呼び出す Google Apps Script です。
 * スプレッドシート列：
 * A URL / B ゲスト名 / C メールアドレス / D 挙式出欠 / E 披露宴出欠 / F アレルギー
 * G 回答日時 / H 確認メール送信日時 / I 1週間前リマインド送信日時
 * J 前日リマインド送信日時 / K 更新日時 / L 招待状URL
 */

const APP_CONFIG = {
  spreadsheetId: '1micDJFsf6ktwZrq_tlIz9TiC4PjbBbv-7dlWgbhMjbs',
  sheetName: '', // 空欄なら一番左のシートを使います。
  timeZone: 'Asia/Tokyo',
  weddingDateYmd: '2027-03-21',
  weddingDateIso: '2027-03-21T10:00:00+09:00',
  weddingDateLabel: '2027年3月21日（日）',
  ceremonyTimeLabel: '10:00〜10:30',
  receptionTimeLabel: '11:00〜14:00',
  groomFullName: '白戸祐輔',
  brideFullName: '大貫愛佳',
  senderName: 'Yusuke & Aika Wedding',
  venueName: 'キンプトン新宿東京',
  venueAddress: '〒160-0023 東京都新宿区西新宿3丁目4-7',
  mapUrl: 'https://www.google.com/maps/search/?api=1&query=%E3%82%AD%E3%83%B3%E3%83%97%E3%83%88%E3%83%B3%E6%96%B0%E5%AE%BF%E6%9D%B1%E4%BA%AC',
  baseInvitationUrl: 'https://Yusuke-Aika-Wedding.github.io/invitation-test2/'
};

const HEADERS = [
  'URL',
  'ゲスト名',
  'メールアドレス',
  '挙式出欠',
  '披露宴出欠',
  'アレルギー',
  '回答日時',
  '確認メール送信日時',
  '1週間前リマインド送信日時',
  '前日リマインド送信日時',
  '更新日時',
  '招待状URL'
];

const COL = {
  url: 1,
  name: 2,
  email: 3,
  ceremony: 4,
  reception: 5,
  allergy: 6,
  submittedAt: 7,
  confirmationSentAt: 8,
  reminder7SentAt: 9,
  reminder1SentAt: 10,
  updatedAt: 11,
  invitationUrl: 12
};

function setup() {
  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  fillInvitationUrls_(sheet);
  formatSheet_(sheet);
  resetReminderTrigger_();
  SpreadsheetApp.flush();
  Logger.log('Setup complete. Webアプリとしてデプロイしてください。');
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  try {
    const action = params.action || 'status';
    if (action === 'ping') return output_({ ok: true, message: 'pong' }, params.callback);
    if (action === 'status') return output_(getStatus_(params.guestId), params.callback);
    if (action === 'submit') return output_(submitResponse_(params), params.callback);
    return output_({ ok: false, error: 'Unknown action.' }, params.callback);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return output_({ ok: false, error: error.message || String(error) }, params.callback);
  }
}

function doPost(e) {
  try {
    const params = parsePostParams_(e);
    return output_(submitResponse_(params));
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return output_({ ok: false, error: error.message || String(error) });
  }
}

function getStatus_(guestIdRaw) {
  const guestId = normalizeGuestId_(guestIdRaw);
  if (!guestId) throw new Error('guestIdがありません。');

  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  const record = findGuestRecord_(sheet, guestId);
  if (!record) throw new Error('ゲスト情報が見つかりません。');

  const values = record.values;
  return {
    ok: true,
    guestId: values.url,
    displayName: values.name || 'ゲスト',
    completed: isCompleted_(values),
    attending: isAttending_(values.ceremony, values.reception),
    email: values.email || '',
    ceremonyAttendance: values.ceremony || '',
    receptionAttendance: values.reception || '',
    allergy: values.allergy || '',
    submittedAt: values.submittedAt ? formatDateTime_(values.submittedAt) : ''
  };
}

function submitResponse_(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const guestId = normalizeGuestId_(params.guestId);
    const name = String(params.name || '').trim();
    const email = String(params.email || '').trim();
    const ceremonyAttendance = normalizeAttendance_(params.ceremonyAttendance);
    const receptionAttendance = normalizeAttendance_(params.receptionAttendance);
    const allergy = String(params.allergy || '').trim();

    if (!guestId) throw new Error('guestIdがありません。');
    if (!name) throw new Error('氏名を入力してください。');
    if (!isValidEmail_(email)) throw new Error('メールアドレスを確認してください。');
    if (!ceremonyAttendance) throw new Error('挙式の出欠を選択してください。');
    if (!receptionAttendance) throw new Error('披露宴の出欠を選択してください。');

    const sheet = getMainSheet_();
    ensureHeaders_(sheet);
    const record = findGuestRecord_(sheet, guestId);
    if (!record) throw new Error('ゲスト情報が見つかりません。');

    const now = new Date();
    const invitationUrl = getInvitationUrl_(guestId);
    sheet.getRange(record.rowNumber, 1, 1, HEADERS.length).setValues([[
      guestId,
      name,
      email,
      ceremonyAttendance,
      receptionAttendance,
      allergy,
      now,
      record.values.confirmationSentAt || '',
      record.values.reminder7SentAt || '',
      record.values.reminder1SentAt || '',
      now,
      invitationUrl
    ]]);

    sendConfirmationEmail_({
      to: email,
      name: name,
      ceremonyAttendance: ceremonyAttendance,
      receptionAttendance: receptionAttendance,
      allergy: allergy,
      invitationUrl: invitationUrl
    });

    const afterMail = new Date();
    sheet.getRange(record.rowNumber, COL.confirmationSentAt).setValue(afterMail);
    sheet.getRange(record.rowNumber, COL.updatedAt).setValue(afterMail);

    return {
      ok: true,
      completed: true,
      attending: isAttending_(ceremonyAttendance, receptionAttendance),
      displayName: name
    };
  } finally {
    lock.releaseLock();
  }
}

function sendReminderEmails() {
  const daysBefore = daysBeforeWedding_(new Date());
  if (![7, 1].includes(daysBefore)) {
    Logger.log(`Reminder skipped. daysBefore=${daysBefore}`);
    return;
  }
  sendReminderEmailsByDays_(daysBefore, false);
}

function testReminder7Days() {
  sendReminderEmailsByDays_(7, true);
}

function testReminder1Day() {
  sendReminderEmailsByDays_(1, true);
}

function sendReminderEmailsByDays_(daysBefore, isTest) {
  const sheet = getMainSheet_();
  ensureHeaders_(sheet);
  const records = readRecords_(sheet);
  const sentColumn = daysBefore === 7 ? COL.reminder7SentAt : COL.reminder1SentAt;
  const sentKey = daysBefore === 7 ? 'reminder7SentAt' : 'reminder1SentAt';
  let sentCount = 0;

  records.forEach(record => {
    const v = record.values;
    if (!isCompleted_(v)) return;
    if (!isValidEmail_(v.email)) return;
    if (!isAttending_(v.ceremony, v.reception)) return;
    if (!isTest && v[sentKey]) return;

    sendReminderEmail_({
      to: v.email,
      name: v.name || 'ゲスト',
      ceremonyAttendance: v.ceremony,
      receptionAttendance: v.reception,
      allergy: v.allergy || '',
      daysBefore: daysBefore,
      invitationUrl: v.invitationUrl || getInvitationUrl_(v.url)
    });

    if (!isTest) {
      sheet.getRange(record.rowNumber, sentColumn).setValue(new Date());
      sheet.getRange(record.rowNumber, COL.updatedAt).setValue(new Date());
    }
    sentCount++;
  });

  Logger.log(`Reminder completed. daysBefore=${daysBefore}, sent=${sentCount}, test=${Boolean(isTest)}`);
}

function sendConfirmationEmail_(data) {
  const subject = '【ご回答控え】祐輔・愛佳 結婚式Web招待状';
  const body = [
    `${data.name} 様`,
    '',
    'この度は、祐輔・愛佳の結婚式Web招待状にご回答いただき、誠にありがとうございます。',
    '以下の内容で承りました。',
    '',
    '【ご回答内容】',
    `氏名：${data.name}`,
    `挙式：${data.ceremonyAttendance}`,
    `披露宴：${data.receptionAttendance}`,
    `アレルギー：${data.allergy || 'なし'}`,
    '',
    '【日時】',
    APP_CONFIG.weddingDateLabel,
    `挙式：${APP_CONFIG.ceremonyTimeLabel}`,
    `披露宴：${APP_CONFIG.receptionTimeLabel}`,
    '',
    '【会場】',
    APP_CONFIG.venueName,
    APP_CONFIG.venueAddress,
    APP_CONFIG.mapUrl,
    '',
    data.invitationUrl ? `招待状ページ：${data.invitationUrl}` : '',
    '',
    '内容に変更がある場合は、新郎新婦まで直接ご連絡ください。',
    '',
    'Yusuke & Aika'
  ].filter(line => line !== null && line !== undefined).join('\n');

  MailApp.sendEmail({
    to: data.to,
    subject: subject,
    body: body,
    name: APP_CONFIG.senderName
  });
}

function sendReminderEmail_(data) {
  const title = data.daysBefore === 7 ? '結婚式まであと1週間です' : '結婚式は明日です';
  const subject = `【リマインド】祐輔・愛佳 結婚式 ${title}`;
  const body = [
    `${data.name} 様`,
    '',
    `祐輔・愛佳の結婚式について、${title}。`,
    '当日のご案内を改めてお送りいたします。',
    '',
    '【日時】',
    APP_CONFIG.weddingDateLabel,
    `挙式：${APP_CONFIG.ceremonyTimeLabel}`,
    `披露宴：${APP_CONFIG.receptionTimeLabel}`,
    '',
    '【会場】',
    APP_CONFIG.venueName,
    APP_CONFIG.venueAddress,
    APP_CONFIG.mapUrl,
    '',
    '【ご回答内容】',
    `挙式：${data.ceremonyAttendance}`,
    `披露宴：${data.receptionAttendance}`,
    `アレルギー：${data.allergy || 'なし'}`,
    '',
    data.invitationUrl ? `招待状ページ：${data.invitationUrl}` : '',
    '',
    '当日お会いできますことを、心より楽しみにしております。',
    '',
    'Yusuke & Aika'
  ].filter(line => line !== null && line !== undefined).join('\n');

  MailApp.sendEmail({
    to: data.to,
    subject: subject,
    body: body,
    name: APP_CONFIG.senderName
  });
}

function fillInvitationUrls_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const output = values.map(row => {
    const url = normalizeGuestId_(row[COL.url - 1]);
    row[COL.invitationUrl - 1] = url ? getInvitationUrl_(url) : '';
    return [row[COL.invitationUrl - 1]];
  });
  sheet.getRange(2, COL.invitationUrl, output.length, 1).setValues(output);
}

function ensureHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsUpdate = HEADERS.some((header, index) => current[index] !== header);
  if (needsUpdate) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function formatSheet_(sheet) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground('#8c2039')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  sheet.autoResizeColumns(1, HEADERS.length);
  sheet.setColumnWidths(COL.email, 1, 220);
  sheet.setColumnWidths(COL.allergy, 1, 220);
  sheet.setColumnWidths(COL.invitationUrl, 1, 330);

  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['出席', '欠席'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COL.ceremony, maxRows, 1).setDataValidation(rule);
  sheet.getRange(2, COL.reception, maxRows, 1).setDataValidation(rule);
  sheet.getRange(2, COL.submittedAt, maxRows, 5).setNumberFormat('yyyy/mm/dd hh:mm:ss');
}

function resetReminderTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'sendReminderEmails')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('sendReminderEmails')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

function readRecords_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values.map((row, index) => ({
    rowNumber: index + 2,
    values: rowToObject_(row)
  })).filter(record => record.values.url);
}

function findGuestRecord_(sheet, guestId) {
  const normalized = normalizeGuestId_(guestId);
  return readRecords_(sheet).find(record => normalizeGuestId_(record.values.url) === normalized) || null;
}

function rowToObject_(row) {
  return {
    url: normalizeGuestId_(row[COL.url - 1]),
    name: String(row[COL.name - 1] || '').trim(),
    email: String(row[COL.email - 1] || '').trim(),
    ceremony: normalizeAttendance_(row[COL.ceremony - 1]),
    reception: normalizeAttendance_(row[COL.reception - 1]),
    allergy: String(row[COL.allergy - 1] || '').trim(),
    submittedAt: row[COL.submittedAt - 1] || '',
    confirmationSentAt: row[COL.confirmationSentAt - 1] || '',
    reminder7SentAt: row[COL.reminder7SentAt - 1] || '',
    reminder1SentAt: row[COL.reminder1SentAt - 1] || '',
    updatedAt: row[COL.updatedAt - 1] || '',
    invitationUrl: String(row[COL.invitationUrl - 1] || '').trim()
  };
}

function getMainSheet_() {
  const spreadsheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
  if (APP_CONFIG.sheetName) {
    const namedSheet = spreadsheet.getSheetByName(APP_CONFIG.sheetName);
    if (namedSheet) return namedSheet;
  }
  return spreadsheet.getSheets()[0];
}

function normalizeGuestId_(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/[^/]+\//, '')
    .replace(/^Yusuke-Aika-Wedding\.github\.io\//i, '')
    .replace(/^invitation-test2\//i, '')
    .replace(/^invitation-test\//i, '')
    .replace(/index\.html$/i, '')
    .replace(/\.html$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function normalizeAttendance_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['出席', '参加', 'attend', 'attending', 'yes', 'true'].includes(text)) return '出席';
  if (['欠席', '不参加', 'decline', 'declined', 'no', 'false'].includes(text)) return '欠席';
  return '';
}

function isCompleted_(values) {
  return Boolean(values.email && values.ceremony && values.reception && values.submittedAt);
}

function isAttending_(ceremonyAttendance, receptionAttendance) {
  return normalizeAttendance_(ceremonyAttendance) === '出席' || normalizeAttendance_(receptionAttendance) === '出席';
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function getInvitationUrl_(guestId) {
  const normalized = normalizeGuestId_(guestId);
  return normalized ? `${APP_CONFIG.baseInvitationUrl}${encodeURIComponent(normalized)}/` : '';
}

function daysBeforeWedding_(date) {
  const todayKey = Utilities.formatDate(date, APP_CONFIG.timeZone, 'yyyy-MM-dd');
  const today = dateKeyToUtc_(todayKey);
  const wedding = dateKeyToUtc_(APP_CONFIG.weddingDateYmd);
  return Math.round((wedding.getTime() - today.getTime()) / 86400000);
}

function dateKeyToUtc_(dateKey) {
  const parts = String(dateKey).split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function formatDateTime_(date) {
  return Utilities.formatDate(new Date(date), APP_CONFIG.timeZone, 'yyyy/MM/dd HH:mm:ss');
}

function parsePostParams_(e) {
  if (!e) return {};
  if (e.parameter && Object.keys(e.parameter).length) return e.parameter;
  const contents = e.postData && e.postData.contents;
  if (!contents) return {};
  try {
    return JSON.parse(contents);
  } catch (_) {
    return contents.split('&').reduce((acc, pair) => {
      const [key, value] = pair.split('=');
      if (key) acc[decodeURIComponent(key)] = decodeURIComponent((value || '').replace(/\+/g, ' '));
      return acc;
    }, {});
  }
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  const cb = String(callback || '').trim();
  if (cb && /^[\w.$]+$/.test(cb)) {
    return ContentService
      .createTextOutput(`${cb}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
