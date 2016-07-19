function writelog(line,addnewline){
	if (zipabox.showlog){
		if (typeof(addnewline) == "undefined")
			addnewline = true;
		var logvalue = "";
		if (zipabox.show_datetime_in_log)
			logvalue += new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '') + " - ";
        console.log(logvalue + "[zipabox] : " + line + ((addnewline) ? "\r\n" : ""));
		// process.stdout.write(logvalue + "[zipabox] : " + line + ((addnewline) ? "\r\n" : ""));
	}
}

var zipabox = {
	showlog: true,
	show_datetime_in_log: true,
	checkforupdate_auto: true,
	baseURL: "https://my.zipato.com:443/zipato-web/rest/",
	initURL: "user/init",
	loginURL: "user/login?username=[username]&token=[token]",
	logoutURL: "user/logout",
	logs_UUID_ATTR_URL: "/log/attribute/[uuid]/[attribute]/",
	setvalueURL: "lights/[uuid]/attributes/[attribute]/value",
	runsceneURL: "scenes/[uuid]/run",
	username: "",
	password: "",
	nonce: "",
	connected: false,
	localip: null,
	devices: [
		{
		        name:"zipabox",
			uri: "zipabox/",
			toString: ZipaboxToString
		},
		{
		        name:"lights",
			uri: "lights/",
			toString: DeviceToString
		},
		{
		        name:"meters",
			uri: "meters/",
			toString: DeviceToString
		},
		{
		        name:"sensors",
			uri: "sensors/",
			toString: DeviceToString
		},
		{
		        name:"scenes",
			uri: "scenes/",
			toString: DeviceToString
		},
		{
			name:"thermostats",
			uri: "thermostats/",
			toString: DeviceToString
		}
	],
	events: {
		OnBeforeConnect: 	null,
		OnAfterConnect: 	null,

		OnBeforeDisconnect:	null,
		OnAfterDisconnect:	null,

		OnBeforeLoadDevices:	null,
		OnAfterLoadDevices:	null,

		OnBeforeLoadDevice: 	null,
		OnAfterLoadDevice:	null,

		OnBeforeGetDevicesLogs:	null,
		OnAfterGetDevicesLogs:	null,

		OnBeforeSetDeviceValue:	null,
		OnAfterSetDeviceValue:	null,

		OnBeforeSetUnLoadedDeviceValue:	null,
		OnAfterSetUnLoadedDeviceValue:	null,

		OnBeforeRunScene:	null,
		OnAfterRunScene:	null,

		OnBeforeUnLoadedRunScene:	null,
		OnAfterUnLoadedRunScene:	null,

		OnInitUserProgress:	null,
		OnLoginUserProgress:	null,
		OnLogoutUserProgress:	null,

		OnBeforeSaveDevicesToFile:	null,
		OnAfterSaveDevicesToFile:	null,
		OnBeforeLoadDevicesFromFile:	null,
		OnAfterLoadDevicesFromFile:	null
	},
	Connect: Connect_FN,
	Disconnect: Disconnect_FN,
	LoadDevices: LoadDevices_FN,

	GetDeviceByName: GetDeviceByName_FN,
	GetDeviceByUUID: GetDeviceByUUID_FN,
	GetDeviceByEndpointUUID: GetDeviceByEndpointUUID_FN,

	GetUnLoadedDeviceByName: GetUnLoadedDeviceByName_FN,

	GetDevicesLogs: GetDevicesLogs_FN,

	SetDeviceValue: SetDeviceValue_FN,
	SetUnLoadedDeviceValue: SetUnLoadedDeviceValue_FN,

	RunScene: RunScene_FN,
	RunUnLoadedScene: RunUnLoadedScene_FN,

	ReplaceURL: ReplaceURL_FN,

	SetLocalIP: function(localip){

		if (zipabox.localip != localip) {
			// TODO: Si local IP pas ok alors
			// return false;

			zipabox.localip = localip;
			zipabox.baseURL = "http://" + zipabox.localip + ":8080/zipato-web/";
			zipabox.initURL = "json/Initialize";
			zipabox.loginURL = "json/Login?method=SHA1&username=[username]&password=[password]";
			zipabox.setvalueURL = "rest/lights/values/[uuid]/[attribute]";
			zipabox.runsceneURL = "rest/scenes/[uuid]/run";

			// Suppression du device "zipabox"
			zipabox.devices.splice(0,1);

			for(var iddevice in zipabox.devices){
				zipabox.devices[iddevice].uri = "rest/" + zipabox.devices[iddevice].uri;
			}
		}

		return true;
	},
	GetJSONModulesByDeviceName: function(devicename){
		writelog("GetJSONModulesByDeviceName");
		var retval = null;
		for(var iddevice in zipabox.devices){
			if (zipabox.devices[iddevice].name == devicename){
				retval = zipabox.devices[iddevice].json;
				break;
			}
		}

		return retval;
	},
	ForEachDevice: function(ForEachFunction){
		if (!(ForEachFunction)) return;
		for(var device in zipabox.devices){
			ForEachFunction(zipabox.devices[device]);
		}
	},
	ForEachModuleInDevice: function(devicename,ForEachFunction){
		writelog("ForEachModuleInDevice");
		var device = zipabox.GetJSONModulesByDeviceName(devicename);

		if (!(device)){
			writelog("ForEachModuleInDevice device not found");
			return null;
		}
		if (!(ForEachFunction)){
			writelog("ForEachModuleInDevice ForEachFunction not found");
			return null;
		}

		for(var module_uuid in device){
			ForEachFunction(module_uuid,device[module_uuid]);
		}
	},
	SaveDevicesToFile: function(filename){
		if (zipabox.events.OnBeforeSaveDevicesToFile) zipabox.events.OnBeforeSaveDevicesToFile();
		writelog("SaveDevicesToFile(" + filename + ")");

		var openDB = require('json-file-db');
		var db = openDB(filename);

		db.put(zipabox.devices, function(err){
			if (err)
				writelog("db.put ERROR : " + err);
			else
				if (zipabox.events.OnAfterSaveDevicesToFile) zipabox.events.OnAfterSaveDevicesToFile();
		});
	},
	LoadDevicesFromFile: function(filename){
		if (zipabox.events.OnBeforeLoadDevicesFromFile) zipabox.events.OnBeforeLoadDevicesFromFile();

		writelog("LoadDevicesFromFile(" + filename + ")");

		var openDB = require('json-file-db');
		var db = openDB(filename);

		db.get(function(err, data){
			if(err)
				writelog("db.get ERROR : " + err);
			else{
				if (data[0]){
					zipabox.devices = data[0];

					for(var dev in zipabox.devices){
						InternalForeachDevice(zipabox.devices[dev]);
					}

					if (zipabox.events.OnAfterLoadDevicesFromFile) zipabox.events.OnAfterLoadDevicesFromFile(null);
				}
				else{
					if (zipabox.events.OnAfterLoadDevicesFromFile) zipabox.events.OnAfterLoadDevicesFromFile("no datas");
				}
			}
		});
	}


};

function Connect_FN(ON_AFTERCONNECT) {
	var sequenty = require('sequenty');
	var SeqFunc = [];

	if (zipabox.events.OnBeforeConnect)
		SeqFunc.push(function(CALLBACK_FN){zipabox.events.OnBeforeConnect(); if(CALLBACK_FN) CALLBACK_FN(); });

	SeqFunc.push(InitUser_FN);
	SeqFunc.push(LoginUser_FN);

	if (zipabox.events.OnAfterConnect)
		SeqFunc.push(function(CALLBACK_FN){ if (zipabox.connected) zipabox.events.OnAfterConnect(); if(CALLBACK_FN) CALLBACK_FN(); });

	if (ON_AFTERCONNECT)
		SeqFunc.push(function(CALLBACK_FN){ if (zipabox.connected) ON_AFTERCONNECT(); if(CALLBACK_FN) CALLBACK_FN(); });

	sequenty.run(SeqFunc);
}
