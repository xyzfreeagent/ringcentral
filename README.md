# Setting up RingCentral Applet
### Add New Applet
First thing you need to do is add a new Applet, in order for it to work with the out of the box applet integration you need to set the **Name** as `Phone Calls` and the **Singular Version of Name** as `Phone Call`, this will generate a **Object** name of  `phone_call` for the applet.

![](https://imgur.com/bm0IqQn.png)

If you setup a different name make sure you replace the occurrences of the `phone_call` applet name in the code.

![image:250077D8-B558-48E4-B2D0-63220D63A482-6899-000007D3DAD20888/Screen Shot 2020-10-27 at 14.29.04.png](https://imgur.com/ZxLfPeP.png)

### Applet Configuration

![image:EB96A0FB-6564-45D3-A92F-82D239528DEB-6899-000007EF10DE6EA4/Screen Shot 2020-10-27 at 14.30.58.png](https://imgur.com/RWg1Qok.png)

**Applet Configuration**: This field is were you can select an already existing applet to use the same configuration, useful when you want multiple applets to manage inside *FreeAgent*, but you only want a single *Applet UI*.
**Width**: The width of the Applet UI.
**Height**: The height of the Applet UI.
**URL** : The URL to your hosted Applet UI.
**Disable FreeAgent Form**: To disable the generic forms/views inside *FreeAgent*, meaning all operations will be managed inside the Applet UI.
**Params**: A JSON configuration field, that allows you to pass anything yo your hosted Applet UI through URL Params.
**AppletId**(Read Only): A generated value, necessary to sync the Applet UI and *FreeAgent*  when using *FreeAgent’s AppletSDK*.

For a default RingCentral Integration this will be our setup:
Width: `300`
Height: `500`
URL: What ever URL are hosting your UI on ie: `http:localhost:1234/ringcentral`
Disable FreeAgent Form: `false` (Unchecked)
Params: 
```
{"clientId": "Ring Central ClientId",
"clientSecret": "Ring Central Client Secret",
"redirectUri":"https://ringcentral.github.io/ringcentral-embeddable/redirect.html"}
```
You can get clientId and clientSecret from [RingCentral Developers](https://developers.ringcentral.com/) 

![image:CA80EB68-AC42-418D-A6D2-42B80482366B-6899-000008C05B8CFFD0/Screen Shot 2020-10-27 at 14.45.59.png](https://imgur.com/pSaMaOo.png)

Next you need to add `https://ringcentral.github.io/ringcentral-embeddable/redirect.html` as a **OAuth Redirect URI** under your RingCentral App Settings.

### Choice Lists
In order for some fields to work correctly with the integration we need to previously create Choice Lists, we can do that going to **Manage Choice Lists**  under Admin Settings.

We’ll add the following all with **Allow Ad-hoc Creation** enabled, we can leave the options empty and let RingCentral take care of setting the correct values.
![image:3DEB6EA8-39AD-4652-9927-3BAD70D2BF31-7370-000129B1ED71A616/Screen Shot 2020-11-03 at 14.00.05.png](https://imgur.com/EeKGQrB.png)

### Form Sections
Create a new Form Section for Outcome 

### Phone Call Form Fields
In order for the Integration to work without code changes, the field setup has to match exactly as follows. (If you mess up, it’s easy to change on the code).

| Field Name     | Type                        | System Name       | Section |
|————————|——————————————|—————————|————|
| From           | Phone                       | phone_call_field0 | Default |
| To             | Phone                       | phone_call_field1 | Default |
| Contact        | Reference -> Contacts       | phone_call_field2 | Default |
| Duration       | Number with mask ’00:00:00’ | phone_call_field3 | Default |
| Direction      | Choice List (Direction)     | phone_call_field4 | Default |
| Status         | Status                      | phone_call_field5 | Default |
| Note           | Note                        | phone_call_field6 | Outcome |
| RingCentral ID | Text (Unique)               | phone_call_field7 | Default |
| Outcome        | Choice List (Outcome)       | phone_call_field8 | Outcome |

Make sure Outcome and Notes are under the Outcome Section.

If the system name for one of the fields doesn’t match you will have to make your field match its System Name, its as easy as going to the code and modifying this part:

```
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
```

If everything was configured correctly you’re all set to start making calls with FreeAgent and RingCentral.


### Card Configuration
Under your Applets’s Setup you can configure Card Configuration to match your desired data.

![image:08B9AB70-6C46-42E1-B3F1-04694FD08EFC-6899-0000404025B3ADCC/Screen Shot 2020-10-28 at 15.03.16.png](https://imgur.com/vElpjr1.png)

### App Action
To make calls from your contact’s detail page you can also add a new **App Action**. Go to App Setup/Contacts/App Actions and a a new Custom Code App Action with the following code:

```
(function(contact, context){
	context.clientAPI.sendEvent(`makeCall`, { 
		record: contact,
  });
  return 0;
}(contact, context));
```

The sendEvent method lets you send any event where you set the name and the payload you want to send to the Applet UI. The Applet UI code is expecting a makeCall event with the record, in order to call the work phone.

### SMS Applet
— Configuration use clone from Phone Calls

— Fields
| Field Name     | Type                         | System Name |
|————————|———————————————|——————|
| From           | Phone                        | sms_field0  |
| To             | Phone                        | sms_field1  |
| Contact        | Referece -> Contacts         | sms_field2  |
| Subject        | Note                         | sms_field3  |
| Type           | Choice List (Type)           | sms_field4  |
| Message Status | Choice List (Message Status) | sms_field5  |
| Read Status    | Choice List (Rad Status)     | sms_field6  |
| Direction      | Choice List (Direction)      | sms_field7  |
| RingCentral ID | Text (Unique)                | sms_field8  |

— Card Configuration
— App Action
```
(function(contact, context){
	context.clientAPI.sendEvent('sendSMS', {
		record: contact,
	});
  return 0;
}(contact, context));
```

