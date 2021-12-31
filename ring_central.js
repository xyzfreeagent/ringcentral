let FAClient = null;
let RingCentral = null;
let notyf = null;
let currentMatchedContact = null;
let matchingContacts = false;
let ongoingCall = null;
let currentCallNumber = null;
let notificationOpen = false;

const DIRECTION = {
  inbound: '6563c5c8-b57e-41d6-8ba6-be076b464219',
  outbound: 'd981eacd-2361-45c3-ad01-22bbb4871298'
};

const SERVICE = {
  name: 'FreeAgentService',
  appletId: `aHR0cHM6Ly9mcmVlYWdlbnRzb2Z0d2FyZTEuZ2l0bGFiLmlvL2FwcGxldHMvcmluZ2NlbnRyYWwv`,
};

const PHONE_APPLET_CONFIGURATION = {
  name: 'phone_call',
};

PHONE_APPLET_CONFIGURATION.fields = {
  from: `${PHONE_APPLET_CONFIGURATION.name}_field0`, // Phone
  to: `${PHONE_APPLET_CONFIGURATION.name}_field1`, // Phone
  contact: `${PHONE_APPLET_CONFIGURATION.name}_field2`, // Reference to Contacts
  duration: `${PHONE_APPLET_CONFIGURATION.name}_field3`, // Number with mask `00:00:00`
  direction: `${PHONE_APPLET_CONFIGURATION.name}_field4`, // Choice List Adhoc,
  status: `${PHONE_APPLET_CONFIGURATION.name}_field5`, // Status
  note: `${PHONE_APPLET_CONFIGURATION.name}_field6`, // Note
  ringcentralId: `${PHONE_APPLET_CONFIGURATION.name}_field7`, // Text (unique)
};

const SMS_APPLET_CONFIGURATION = {
  name: 'sms',
};

SMS_APPLET_CONFIGURATION.fields = {
  from: `${SMS_APPLET_CONFIGURATION.name}_field0`, // Phone
  to: `${SMS_APPLET_CONFIGURATION.name}_field1`, // Phone
  contact: `${SMS_APPLET_CONFIGURATION.name}_field2`, // Reference to Contacts
  subject: `${SMS_APPLET_CONFIGURATION.name}_field3`, // Note
  type: `${SMS_APPLET_CONFIGURATION.name}_field4`, // Choice List (Adhoc)
  messageStatus: `${SMS_APPLET_CONFIGURATION.name}_field5`, // Choice List (Adhoc)
  readStatus: `${SMS_APPLET_CONFIGURATION.name}_field6`, // Choice List (Adhoc)
  direction: `${SMS_APPLET_CONFIGURATION.name}_field7`, // Choice List (Adhoc)
  ringcentralId: `${SMS_APPLET_CONFIGURATION.name}_field8`, // Text (unique)
}

const PHONE_FIELD_TYPES = [
  { field: 'work_phone', type: 'business' },
  { field: 'mobile_phone', type: 'mobile' },
  { field: 'home_phone', type: 'home' },
  { field: 'alternate_phone_1', type: 'other' },
];

function setCurrentMatchedContact(contact) {
  currentMatchedContact = contact;
}

async function startupService() {
  notyf = new Notyf({
    duration: 20000,
    dismissible: true,
    position: {
      x: 'center',
      y: 'bottom',
    },
    types: [
      {
        type: 'info',
        className: 'info-notyf',
        icon: false,
      },
    ],
  });

  FAClient = new FAAppletClient({
    appletId: SERVICE.appletId,
  });

  FAClient.on('makeCall', (data) => {
    const phoneNumber = _.get(data, 'record.field_values.work_phone.value');
    makeCall(phoneNumber);
  });


  FAClient.on('sendSMS', (data) => {
    const phoneNumber = _.get(data, 'record.field_values.work_phone.value');
    FAClient.open();
    RingCentral.postMessage({
      type: 'rc-adapter-new-sms',
      phoneNumber,
    }, '*');
  });

  FAClient.on('phone_field_clicked', ({ record, number }) => {
    setCurrentMatchedContact(record);
    currentCallNumber = number;
    makeCall(number);
  });

  const { clientId, clientSecret, redirectUri } = FAClient.params;
  if (clientId && clientSecret) {
    const iFrame = document.createElement('iframe');
    const appServer = 'https://platform.devtest.ringcentral.com';
    iFrame.src = `https://ringcentral.github.io/ringcentral-embeddable/app.html?appKey=${clientId}&appSecret=${clientSecret}&appServer=${appServer}&redirectUri=${redirectUri}`;
    iFrame.style = 'width: 100%; height: 100%; border: none;';
    iFrame.allow = 'microphone';
    window.addEventListener('message', ringCentralListener);
    removeTextMessage();
    document.getElementById('frameContainer').appendChild(iFrame);
    RingCentral = iFrame.contentWindow;
    console.log(FAClient.params);
    console.log(RingCentral);
  }
}

function makeCall(phoneNumber) {
  RingCentral.postMessage(
    {
      type: 'rc-adapter-new-call',
      phoneNumber,
      toCall: true,
    },
    '*',
  );
}

function logMessagesManually(data) {
  const triggerType = _.get(data, 'body.triggerType');

  if (triggerType !== 'manual') {
    return RingCentral.postMessage(
      {
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: 'ok' },
      },
      '*',
    );
  }

  const conversation = _.get(data, 'body.conversation');
  const messages = _.get(conversation, 'messages', []);
  const phoneNumbers = _.get(conversation, 'correspondents', [])
        .map((c) => c.phoneNumber);
        
  logMessages(messages, phoneNumbers, () => {
    RingCentral.postMessage(
      {
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: 'ok' },
      },
      '*',
    );
  })
}

function logCallById(callId, callValues, callback) {
  FAClient.listEntityValues(
    {
      entity: PHONE_APPLET_CONFIGURATION.name,
      filters: [
        {
          field_name: PHONE_APPLET_CONFIGURATION.fields.ringcentralId,
          operator: 'includes',
          values: [callId],
        },
      ],
    },
    (existingPhoneCalls) => {
      const existingPhoneCall = _.get(existingPhoneCalls, '[0]');
      FAClient.upsertEntity({
        id: _.get(existingPhoneCall, 'id', ''),
        ...callValues,
      }, callback);
    },
  );
}

function logCallsManually(data) { 
  const responseId = data.requestId;
  const triggerType = data.body && data.body.triggerType;

  if (triggerType) {
    return RingCentral.postMessage(
      {
        type: 'rc-post-message-response',
        responseId,
        response: { data: 'ok' },
      },
      '*',
    );
  }

  const callId = _.get(data, 'body.call.id');
  const callValues = getCallValuesFromData(data);

  logCallById(callId, callValues, () => {
    RingCentral.postMessage(
      {
        type: 'rc-post-message-response',
        responseId,
        response: { data: 'ok' },
      },
      '*',
    );
  });
}

function parseNumbersForPattern(numbers) {
  return numbers.reduce((prev, next) => {
    const parsedNumber = libphonenumber.parsePhoneNumberFromString(next);
    return [
      ...prev,
      ...(parsedNumber
        ? [parsedNumber.number, parsedNumber.nationalNumber]
        : []),
    ];
  }, [])
  .filter((n) => n && n.length > 4).join('|');
}

function matchContacts(data) {
  if (!ongoingCall) return;
  
  const phoneNumbers = data.body.phoneNumbers;

  if (currentMatchedContact) {
    return setMatchedContacts(currentMatchedContact, data, phoneNumbers);
  }

  if (phoneNumbers.length > 1) return;

  const pattern = parseNumbersForPattern(phoneNumbers);

  FAClient.listEntityValues(
    {
      entity: 'contact',
      pattern,
      limit: 1,
    },
    (contacts) => {
      setCurrentMatchedContact(_.get(contacts, '[0]'));
      setMatchedContacts(currentMatchedContact, data, phoneNumbers);
    },
  );
}

function sendContactNotification(contact) {
  if (notificationOpen) return;
  notificationOpen = true;
  let notification = notyf.open({
    type: 'info',
    message: `Contact ${_.get(
      contact,
      'field_values.full_name.value',
    )} found! Click to navigate to record`,
  });

  notification.on('click', ({ target, event }) => {
    FAClient.navigateTo(`/contact/view/${contact.id}`);
    notyf.dismiss(notification);
  });

  notification.on('dismiss', () => {
    notificationOpen = false;
  });
}

function setMatchedContacts(contact, data, phoneNumbers) {
  let matchedContacts = {};
  if (contact) {
    matchedContacts = phoneNumbers.reduce((acc, phoneNumber) => {
      return {
        ...acc,
        [phoneNumber]: [
          {
            id: contact.id,
            type: SERVICE.name,
            name: _.get(contact, 'field_values.full_name.value'),
            phoneNumbers: PHONE_FIELD_TYPES
              .map((phoneField) => ({
                phoneNumber: _.get(
                  contact,
                  `field_values[${phoneField.field}].value`,
                ),
                phoneType: phoneField.type,
              }))
              .filter((f) => f.phoneNumber),
          },
        ],
      };
    }, {});
  }
  renderContactButtton();
  RingCentral.postMessage(
    {
      type: 'rc-post-message-response',
      responseId: data.requestId,
      response: {
        data: matchedContacts,
      },
    },
    '*',
  );
}

function getCallValuesFromData(data) {
  const callId = _.get(data, 'body.call.id', _.get(data, 'call.callId'));
  const from = _.get(data, 'body.call.from.phoneNumber', _.get(data, 'call.fromNumber') || _.get(data, 'call.from'));
  const to = _.get(data, 'body.call.to.phoneNumber', _.get(data, 'call.to'));
  const direction = _.get(data, 'body.call.direction', _.get(data, 'call.direction'));
  const note = _.get(data, 'body.note', '');
  const contact = _.get(currentMatchedContact, 'id');
  const duration = _.get(data, 'body.call.duration', Math.round((_.get(data, 'call.endTime', 0) - _.get(data, 'call.creationTime', 0)) / 1000));
  
  // direction = DIRECTION[(direction||'').toLowerCase()];

  return {
    entity: PHONE_APPLET_CONFIGURATION.name,
    field_values: {
      [PHONE_APPLET_CONFIGURATION.fields.from]: from,
      [PHONE_APPLET_CONFIGURATION.fields.to]: to,
      [PHONE_APPLET_CONFIGURATION.fields.contact]: contact,
      [PHONE_APPLET_CONFIGURATION.fields.duration]: duration,
      [PHONE_APPLET_CONFIGURATION.fields.direction]: direction,
      [PHONE_APPLET_CONFIGURATION.fields.ringcentralId]: callId,
      [PHONE_APPLET_CONFIGURATION.fields.note]: note,
    },
  };
}

function handleCallEnd(data) {
  const callId = _.get(data, 'call.callId');

  const callValues = getCallValuesFromData(data);

  logCallById(callId, callValues, ({ entity_value: phoneCall }) => {
    const entityInstance = {
      ...phoneCall,
      field_values: {
        ...phoneCall.field_values,
        [PHONE_APPLET_CONFIGURATION.fields.status]: {
          ...(phoneCall.field_values[PHONE_APPLET_CONFIGURATION.fields.status]),
          value: true,
        }
      }
    };

    FAClient.showModal('entityFormModal', {
      entity: PHONE_APPLET_CONFIGURATION.name,
      entityLabel: 'Phone Call Outcome Log',
      entityInstance,
      showButtons: false,
    });
    
  });
}

function getSMSValues(message, contact) {
  const ringcentralID = _.get(message, 'id');
  const from = _.get(message, 'from.phoneNumber');
  const to = _.get(message, 'to[0].phoneNumber');
  const subject = _.get(message, 'subject');
  const type = _.get(message, 'type');
  const direction = _.get(message, 'direction');
  const messageStatus = _.get(message, 'messageStatus');
  const readStatus = _.get(message, 'readStatus');  
  return {
    entity: SMS_APPLET_CONFIGURATION.name,
    field_values: {
      [SMS_APPLET_CONFIGURATION.fields.from]: from,
      [SMS_APPLET_CONFIGURATION.fields.to]: to,
      [SMS_APPLET_CONFIGURATION.fields.contact]: contact && contact.id,
      [SMS_APPLET_CONFIGURATION.fields.subject]: subject,
      [SMS_APPLET_CONFIGURATION.fields.type]: type,
      [SMS_APPLET_CONFIGURATION.fields.messageStatus]: messageStatus,
      [SMS_APPLET_CONFIGURATION.fields.readStatus]: readStatus,
      [SMS_APPLET_CONFIGURATION.fields.direction]: direction,
      [SMS_APPLET_CONFIGURATION.fields.ringcentralId]: `${ringcentralID}`,
    },
  };
}

function logMessages(messages, phoneNumbers, callback) {
  const messagesIDs = messages.map((m) => `${m.id}`);

  FAClient.listEntityValues(
    {
      entity: SMS_APPLET_CONFIGURATION.name,
      filters: [
        {
          field_name: SMS_APPLET_CONFIGURATION.fields.ringcentralId,
          operator: 'includes',
          values: messagesIDs,
        },
      ],
    },
    (existingMessages) => {
      const newMessages = _.differenceWith(
        messages,
        existingMessages,
        (a, b) =>
          `${a.id}` ===
          _.get(
            b,
            `field_values.${SMS_APPLET_CONFIGURATION.fields.ringcentralId}.value`,
          ),
      );

      const pattern = parseNumbersForPattern(phoneNumbers);
      
      FAClient.listEntityValues(
        {
          entity: 'contact',
          pattern,
          limit: 1,
        },
        (contacts) => {
          const contact = _.get(contacts, '[0]');
          newMessages.map((message, index) => {
            const isLast = index === newMessages.length - 1;
            const smsValues = getSMSValues(message, contact);
            FAClient.createEntity(smsValues, (created) => {
              if (isLast) {
                callback();
              }
            });
          });
        },
      );
    }
  );
}

function handleUpdatedMessage(data) {
  const phoneNumber = _.get(data, 'message.from.phoneNumber');
  const message = _.get(data, 'message');
  const smsValues = getSMSValues(message);

  logMessages([message], [phoneNumber], smsValues, () => {});
}

function cleanFooter() {
  const footer = document.getElementById('footer');
  footer.innerHTML = '';
}

function renderContactButtton() {
  cleanFooter();
  if(!currentMatchedContact) return null;
  const footerButton = document.createElement('button');
  footerButton.innerText = `Navigate to ${_.get(
    currentMatchedContact,
    'field_values.full_name.value',
  )}`;
  footerButton.onclick = () => {
    FAClient.navigateTo(`/contact/view/${currentMatchedContact.id}`);
  };
  footer.appendChild(footerButton);
}

function ringCentralListener(event) {
  const data = event.data;
  if (!data) return;
  switch (data.type) {
    case 'rc-call-ring-notify':
      ongoingCall = true;
      FAClient.open();
      break;
    case 'rc-call-init-notify':
      setCurrentMatchedContact(null);
      FAClient.open();
      ongoingCall = true;
      break; 
    case 'rc-call-end-notify':
      matchingContacts = false;
      currentCallNumber = null;
      ongoingCall = false;
      handleCallEnd(data);
      cleanFooter();
      break;
    case 'rc-message-updated-notify':
      handleUpdatedMessage(data);
      break;
    case 'rc-inbound-message-notify':
      const phoneNumber = _.get(data, 'message.from.phoneNumber');
      RingCentral.postMessage({
        type: 'rc-adapter-new-sms',
        phoneNumber,
        conversation: true,
      }, '*');
      FAClient.open();
      break;
    case 'rc-route-changed-notify':
      if (!data.path.includes('/calls/active')) {
        cleanFooter();
      }
      if (data.path === '/history') {
        const footerButton = document.createElement('button');
        footerButton.innerText = 'All Phone Calls';
        footerButton.onclick = () => {
          FAClient.navigateTo(
            `/entity/${PHONE_APPLET_CONFIGURATION.name}/view/all`,
          );
        };
        footer.appendChild(footerButton);
      } else if (data.path === '/messages') {
        const footerButton = document.createElement('button');
        footerButton.innerText = 'All SMS';
        footerButton.onclick = () => {
          FAClient.navigateTo(
            `/entity/${SMS_APPLET_CONFIGURATION.name}/view/all`,
          );
        };
        footer.appendChild(footerButton);
      }
      break;
    case 'rc-login-status-notify':
      if (data.loggedIn) {
        RingCentral.postMessage(
          {
            type: 'rc-adapter-register-third-party-service',
            service: {
              name: SERVICE.name,
              callLoggerPath: '/callLogger',
              callLoggerTitle: `Log to ${SERVICE.name}`,
              messageLoggerPath: '/messageLogger',
              messageLoggerTitle: `Log to ${SERVICE.name}`,
              contactMatchPath: '/contacts/match',
              contactsPath: '/contacts',
              showLogModal: true,
            },
          },
          '*',
        );
      }
      break;
    case 'rc-post-message-request':
      if (data.path === '/callLogger') {
        logCallsManually(data);
      }
      if (data.path === '/messageLogger') {
        logMessagesManually(data);
      }
      if (data.path === '/contacts/match') {
        matchContacts(data);
      }
      break;
    case 'rc-callLogger-auto-log-notify':
      break;
    default:
      break;
  }
}

function removeTextMessage() {
  const loadingText = document.getElementById('loading-text');
  loadingText.remove();
}
