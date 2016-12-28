
/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app.run(function($network, $uci, $wireless){
	$network.subsystem(function(){
		return {
			annotateClients: function(clients){
				var def = $.Deferred(); 
				$wireless.getConnectedClients().done(function(wclients){
					clients.map(function(cl){
						var wcl = wclients.find(function(wc){ return String(wc.macaddr).toLowerCase() == String(cl.macaddr).toLowerCase(); }); 
						if(wcl) { 
							cl._display_widget = "wireless-client-lan-display-widget"; 
							cl._wireless = wcl; 
						}; 
					}); 
					def.resolve(); 
				}).fail(function(){
					def.reject(); 
				}); 
				return def.promise(); 
			}, 
		}
	}); 
}); 

JUCI.app.factory("$wireless", function($uci, $rpc, $network, gettext){
	
	function Wireless(){
		this.scheduleStatusText = gettext("off"); 
		this.wpsStatusText = gettext("off"); 
	}
	
	Wireless.prototype.annotateAdapters = function(adapters){
		var def = $.Deferred(); 
		var self = this; 
		self.getInterfaces().done(function(list){
			var devices = {}; 
			list.map(function(x){ if(x[".info"]) devices[x[".info"].device] = x; }); 
			adapters.map(function(dev){
				if(dev.device in devices){
					dev.name = devices[dev.device].ssid.value + "@" + dev.device; 
					dev.type = "wireless"; 
					delete devices[dev.device]; 
				}
			});
			Object.keys(devices).map(function(k){
				var device = devices[k]; 
				adapters.push({
					name: device.ssid.value, 
					device: device.ifname.value, 
					type: "wireless", 
					state: "DOWN"
				}); 
			}); 
			def.resolve(); 
		}).fail(function(){
			def.reject(); 
		}); 
		return def.promise(); 
	}

	Wireless.prototype.getConnectedClients = function(){
		var def = $.Deferred(); 
		if(!$rpc.juci.wireless) {
			setTimeout(function(){ def.reject(); }, 0); 
			return def.promise(); 
		}
		$rpc.juci.wireless.clients().done(function(clients){
			if(clients && clients.clients) {
				var clist = []; 
				Object.keys(clients.clients).map(function(wldev){
					var list = Object.keys(clients.clients[wldev]).map(function(x){ 
						var cl = clients.clients[wldev][x]; 
						cl.macaddr = String(x).toLowerCase(); 
						return cl; 
					}).map(function(x){ x.wldev = wldev; return x; }); 
					clist = clist.concat(list); 
				}); 
				clist.map(function(cl){
					if(cl.rssi && cl.noise && cl.noise > 0)
						cl.snr = Math.floor(1 - (cl.rssi / cl.noise)); 
					if(cl.rx_rate && cl.rx_rate > 0)
						cl.rx_rate = Math.floor((cl.rx_rate / 1000) + 0.5); 
					if(cl.tx_rate && cl.tx_rate > 0)
						cl.tx_rate = Math.floor((cl.tx_rate / 1000) + 0.5); 
				}); 
				def.resolve(clist); 
			}
			else def.reject(); 
		}); 
		return def.promise(); 
	}

	Wireless.prototype.getScanResults = function(){
		var deferred = $.Deferred(); 
		$rpc.juci.wireless.scan().done(function(result){
			// merge together all interface for all devices
			var aps = []; 
			Object.keys(result).map(function(wldev){
				aps = aps.concat(result[wldev]); 
			}); 
			deferred.resolve(aps); 
		}).fail(function(){
			deferred.reject(); 
		}); 
		return deferred.promise(); 
	}
	
	Wireless.prototype.getDevices = function(){
		var deferred = $.Deferred(); 
		$rpc.juci.wireless.devices().done(function(result){
			if(!result || !result.devices) return; 
			$uci.$sync("wireless").done(function(){
				$uci.wireless["@wifi-device"].map(function(x){
					var dev = result.devices.find(function(y){ return x.ifname.value == y.device; }); 
					if(dev) x[".info"] = dev; 
					else x[".info"] = {}; // avoid crashes
				}); 
				deferred.resolve($uci.wireless["@wifi-device"]); 
			}); 
		}); 
		return deferred.promise(); 
	}
	
	Wireless.prototype.getInterfaces = function(){
		var deferred = $.Deferred(); 
		$rpc.juci.wireless.devices().done(function(result){
			$uci.$sync("wireless").done(function(){
				var ifs = $uci.wireless["@wifi-iface"]; 
				ifs.map(function(x){
					x[".info"] = result.devices.find(function(y){ return x.ssid.value == y.ssid; }); 
				}); 
				// TODO: this is an ugly hack to automatically calculate wifi device name
				// it is not guaranteed to be exact and should be replaced by a change to 
				// how openwrt handles wireless device by adding an ifname field to wireless 
				// interface configuration which will be used to create the ethernet device.  
				/*
				var counters = {}; 
				ifs.map(function(i){
					if(i.ifname.value == ""){
						if(!counters[i.device.value]) counters[i.device.value] = 0; 
						if(counters[i.device.value] == 0)
							i.ifname.value = i.device.value; 
						else
							i.ifname.value = i.device.value + "." + counters[i.device.value]; 
						counters[i.device.value]++; 
					}
				});*/ 
				deferred.resolve(ifs); 
			}); 
		}).fail(function(){ deferred.reject(); }); 
		return deferred.promise(); 
	}
	
	Wireless.prototype.getDefaults = function(){
		var deferred = $.Deferred(); 
		$rpc.juci.wireless.defaults().done(function(result){
			if(!result) {
				deferred.reject(); 
				return; 
			}
			
			deferred.resolve(result); 
		}).fail(function(){
			deferred.reject(); 
		});  
		return deferred.promise(); 
	}
/*	
	Wireless.prototype.scan = function(){
		var deferred = $.Deferred(); 
		$rpc.juci.broadcom.wld.scan().done(function(result){
			
		}).always(function(){
			deferred.resolve(); 
		});  
		return deferred.promise(); 
	}
	
	Wireless.prototype.getScanResults = function(){
		var deferred = $.Deferred(); 
		$rpc.juci.broadcom.wld.scanresults().done(function(result){
			deferred.resolve(result.list); 
		}); 
		return deferred.promise(); 
	}
*/	
	return new Wireless(); 
}); 

JUCI.app.run(function($ethernet, $wireless, $uci){
	$ethernet.addSubsystem($wireless); 
	// make sure we create status section if it does not exist. 
	$uci.$sync("wireless").done(function(){
		if(!$uci.wireless.status) {
			$uci.wireless.$create({
				".type": "wifi-status", 
				".name": "status"
			}).done(function(){
				$uci.$save();
			});  
		} 
		$uci.$save(); 
	}); 
}); 

UCI.$registerConfig("wireless"); 
UCI.wireless.$registerSectionType("wifi-status", {
	"wlan":		{ dvalue: true, type: Boolean }, 
	"wps":		{ dvalue: true, type: Boolean },
	"schedule":	{ dvalue: false, type: Boolean },
	"sched_status":	{ dvalue: false, type: Boolean }
}); 
UCI.wireless.$registerSectionType("wifi-schedule", {
	"days":		{ dvalue: [], type: Array, 
		allow: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], 
		alidator: UCI.validators.WeekDayListValidator},
	"time":		{ dvalue: "", type: String, validator: UCI.validators.TimespanValidator }
}, function validator(section){
	if(section.days.value.length == 0){
		return gettext("please pick at least one day to schedule on"); 
	}
	return null; 
}); 
UCI.wireless.$registerSectionType("wifi-device", {
	"type": 			{ dvalue: "", type: String },
	"country": 			{ dvalue: "", type: String},
	"ifname":			{ dvalue: "", type: String }, // primary device of the radio in order to get countrylist from iwinfo
	"band": 			{ dvalue: "none", type: String },
	"bandwidth": 		{ dvalue: 0, type: String },
	"htmode": 			{ dvalue: "", type: String },
	"channel":			{ dvalue: "auto", type: String },
	"scantimer":		{ dvalue: 0, type: Number },
	"wmm":				{ dvalue: false, type: Boolean },
	"wmm_noack":		{ dvalue: false, type: Boolean },
	"wmm_apsd":			{ dvalue: false, type: Boolean },
	"txpower":			{ dvalue: 0, type: Number },
	"rateset":			{ dvalue: "default", type: String, allow: [ "default" ] },
	"frag":				{ dvalue: 0, type: Number },
	"rts":				{ dvalue: 0, type: Number },
	"dtim_period":		{ dvalue: 0, type: Number },
	"beacon_int":		{ dvalue: 0, type: Number },
	"rxchainps":		{ dvalue: false, type: Boolean },
	"rxchainps_qt":		{ dvalue: 0, type: Number },
	"rxchainps_pps":	{ dvalue: 0, type: Number },
	"rifs":				{ dvalue: false, type: Boolean },
	"rifs_advert":		{ dvalue: false, type: Boolean },
	"maxassoc":			{ dvalue: 0, type: Number },
	"doth":				{ dvalue: 0, type: Boolean },
	"dfsc":				{ dvalue: 0, type: Boolean }, // ? 
	"hwmode":			{ dvalue: "auto", type: String },
	"disabled":			{ dvalue: false, type: Boolean },
	"frameburst": 		{ dvalue: false, type: Boolean },
	"obss_coex": 		{ dvalue: false, type: Boolean }, 
	"beamforming": 		{ dvalue: false, type: Boolean }
}); 
UCI.wireless.$registerSectionType("wifi-iface", {
	"device": 			{ dvalue: "", type: String },
	"ifname": 			{ dvalue: "", type: String }, // name of the created device 
	"network":			{ dvalue: "", type: String },
	"mode":				{ dvalue: "ap", type: String },
	"ssid":				{ dvalue: "", type: String },
	"encryption":		{ dvalue: "mixed-psk", type: String },
	"cipher":			{ dvalue: "auto", type: String },
	"key":				{ dvalue: "", type: String },
	"key_index": 		{ dvalue: 1, type: Number }, 
	"key1":				{ dvalue: "", type: String },
	"key2":				{ dvalue: "", type: String },
	"key3":				{ dvalue: "", type: String },
	"key4":				{ dvalue: "", type: String },
	"radius_server":	{ dvalue: "", type: String },
	"radius_port":		{ dvalue: "", type: String },
	"radius_secret":	{ dvalue: "", type: String },
	"ifname":			{ dvalue: "", type: String },
	"gtk_rekey":		{ dvalue: false, type: Boolean },
	"net_rekey":		{ dvalue: 0, type: Number },
	"wps_pbc":			{ dvalue: false, type: Boolean },
	"wmf_bss_enable":	{ dvalue: false, type: Boolean },
	"bss_max":			{ dvalue: 0, type: Number },
	"instance":			{ dvalue: 0, type: Number },
	"up":				{ dvalue: false, type: Boolean },
	"hidden":			{ dvalue: false, type: Boolean },
	"disabled":			{ dvalue: false, type: Boolean },
	"macmode":			{ dvalue: 1, type: Number },
	"macfilter":		{ dvalue: false, type: Boolean },
	"maclist":			{ dvalue: [], type: Array } // match_each: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/ }
}, function validator(section){
	// validate ssid
	if(section.ssid.value.length > 32) 
		return gettext("SSID string can be at most 32 characters long!"); 
	if(section.ssid.value.length == 0)
		return gettext("SSID must be set!"); 
	// validate keys
	if(section.encryption.value.indexOf("wep") == 0){
		for(var id = 1; id <= 4; id++){
			var key = section["key"+id]; 
			if(key && key.value != "" && !key.value.match(/[a-f0-9A-F]{10,26}/)) 
				return gettext("WEP encryption key #"+id+" must be 10-26 hexadecimal characters!"); 
		}
	} else if(section.encryption.value.indexOf("psk2") == 0 || section.encryption.value.indexOf("psk") == 0 || section.encryption.value.indexOf("mixed-psk") == 0 ){
		if(!section.key.value || !(section.key.value.length >= 8 && section.key.value.length < 64))
			return gettext("WPA key must be 8-63 characters long!"); 
	}
	return null; 
});

UCI.juci.$registerSectionType("wireless", {
	"cryptochoices": 			{ dvalue: ["none", "psk2", "psk-mixed"], type: Array }
}); 
UCI.juci.$insertDefaults("wireless"); 


/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessClientModePage", function($scope, $uci, $wireless, gettext){
	$wireless.scan(); 
	JUCI.interval.repeat("wifi-scan", 5000, function(done){
		$wireless.scan(); 
		setTimeout(function(){
			$wireless.getScanResults().done(function(aps){
				$scope.access_points = aps;
				$scope.$apply(); 
				done(); 
			});
		}, 4000); 
	}); 
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessClientsPage", function($scope, $network, $wireless, $rpc, $tr, gettext){
	JUCI.interval.repeat("wireless-clients-refresh", 5000, function(done){
		$network.getConnectedClients().done(function(all_clients){
			$scope.clients = all_clients.filter(function(x) { return !!x._wireless; }); 
			$scope.$apply(); 
			done(); 
		}); 
	}); 
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessDevicesPage", function($scope, $uci, $wireless){
	$wireless.getDevices().done(function(devices){
		$scope.devices = devices; 
		$scope.misconfigured = devices.find(function(x){ return !x.ifname.value; }); 
		$scope.$apply(); 
	}); 
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessFilteringPage", function($scope, $uci, gettext){
	window.uci = $uci; 
	$scope.uci = $uci; 
	
	$uci.$sync(["wireless", "hosts"]).done(function(){
		$scope.interfaces = $uci.wireless['@wifi-iface'];
		
		// TODO: ================ this is a duplicate. It should be put elsewhere!
		$scope.devices = $uci.wireless["@wifi-device"].map(function(x){
			// TODO: this should be a uci "displayname" or something
			if(x.band.value == "a") x[".label"] = gettext("5GHz"); 
			else if(x.band.value == "b") x[".label"] = gettext("2.4GHz"); 
			return { label: x[".label"], value: x[".name"] };
		}); 
		$uci.wireless["@wifi-iface"].map(function(x){
			var dev = $uci.wireless[x.device.value]; 
			x[".frequency"] = dev[".label"]; 
		});  
		// ========================
		
		$scope.$apply(); 
	}).fail(function(err){
		console.log("failed to sync config: "+err); 
	}); 
	
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessGeneralPage", function($scope, $uci, $wireless){
	$uci.$sync("wireless").done(function(){
		$scope.status = $uci.wireless.status; 
		//$scope.router = $router; 
		$scope.$apply(); 
	}); 
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessInterfacesPage", function($scope, $uci, $wireless, gettext, prompt, $modal){
	$wireless.getInterfaces().done(function(interfaces){
		$wireless.getDevices().done(function(devices){
			$scope.devices = devices; 
			$scope.interfaces = interfaces; 
			$scope.interfaces.map(function(x){
				var dev = devices.find(function(dev) { return dev[".name"] == x.device.value; }); 
				x[".frequency"] = (dev||{})[".frequency"]; 
			}); 
			$scope.$apply(); 
		}); 
	}); 
	
	$scope.getItemTitle = function($item){
		return ($item.ssid.value + ' (' + $item[".frequency"] + ')'); 
	}
	
	$scope.onCreateInterface = function(){
		var modalInstance = $modal.open({
			animation: $scope.animationsEnabled,
			templateUrl: 'widgets/wifi-radio-picker-modal.html',
			controller: 'WifiRadioPickerModal',
			size: size,
			resolve: {
				interfaces: function () {
					return $scope.interfaces;
				}
			}
		});

		modalInstance.result.then(function (data) {
			$uci.wireless.$create({
				".type": "wifi-iface",
				"device": data.radio, 
				"ssid": data.ssid, 
				"mode": data.mode
			}).done(function(interface){
				//$scope.interfaces.push(interface);
				var radio = $scope.devices.find(function(x){ return x[".name"] == interface.device.value; })||{};  
				interface[".frequency"] = radio[".frequency"]; 
				if(data.mode == "sta"){
					radio.apsta.value = true; 
				}
				$scope.$apply(); 
			}); 
		}, function () {
			console.log('Modal dismissed at: ' + new Date());
		});
	}
	
	$scope.onDeleteInterface = function(conn){
		if(!conn) alert(gettext("Please select a connection in the list!")); 
		if(confirm(gettext("Are you sure you want to delete this wireless interface?"))){
			conn.$delete().done(function(){
				$scope.$apply(); 
			}); 
		}
	}
	
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessScanPage", function($scope, $uci, $wireless, gettext, prompt, $modal){
	$scope.onScan = function(){
		$scope.scanning = true; 
		$wireless.getScanResults().done(function(result){
			$scope.results = result; 
		}).always(function(){
			$scope.scanning = false; 
			$scope.$apply(); 
		}); 
	}
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessStatusSimplePage", function($scope, $rpc, $tr, gettext){
	JUCI.interval.repeat("wireless-refresh", 5000, function(done){
		$rpc.juci.wireless.devices().done(function(result){
			if(!result || !result.devices) return; 
			$scope.devices = result.devices.map(function(dev){
				dev._table = [
					[$tr(gettext("SSID")), dev.ssid],
					[$tr(gettext("Encryption")), (dev.encryption || {}).description],
					[$tr(gettext("BSSID")), dev.bssid],
					[$tr(gettext("Channel")), dev.channel], 
					[$tr(gettext("HW Modes")), Object.keys(dev.hwmodes)
						.filter(function(x){ return dev.hwmodes[x]; })
						.map(function(x){ return "11"+x; }).join(", ")
					], 
					[$tr(gettext("TX Power")), dev.txpower+" dBm"], 
					[$tr(gettext("Bitrate")), (dev.bitrate/1000)+" Mbps"], 
					[$tr(gettext("Quality")), dev.quality], 
					[$tr(gettext("Signal")), dev.signal + " dBm"],
					[$tr(gettext("Noise")), dev.noise + " dBm"],
					//[$tr(gettext("Frequency")), ""+(parseFloat(dev.frequency)/1000.0)+" GHz"]
				]; 
				return dev; 
			}); 
			$scope.$apply(); 
			done(); 
		}); 
	}); 
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("wirelessStatusPage", function($scope, $uci, $wireless, gettext){
	$scope.order = function(pred){
		$scope.predicate = pred; 
		$scope.reverse = ($scope.predicate === pred) ? !$scope.reverse : false;
	}
	$uci.$sync("wireless").done(function(){
		$scope.dfs_enabled = $uci.wireless["@wifi-device"].find(function(x){ return x.dfsc.value != 0; }) != null; 
		$scope.doScan = function(){
			$scope.scanning = 1; 
			async.eachSeries($uci.wireless["@wifi-device"].filter(function(x){ return x.dfsc.value != 0; }), function(dev, next){
				console.log("Scanning on "+dev[".name"]); 
				$wireless.scan({device: dev[".name"]}).done(function(){
					setTimeout(function(){
						console.log("Getting scan results for "+dev[".name"]); 
						$wireless.getScanResults({device: dev[".name"]}).done(function(aps){
							$scope.access_points = aps;
							$scope.scanning = 0; 
							$scope.$apply(); 
						}); 
					}, 4000); 
					next(); 
				}); 
			}); 
		} 
	}); 
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("networkDeviceWirelessEdit", function($compile){
	return {
		scope: {
			device: "=ngModel"
		}, 
		templateUrl: "/widgets/network-device-wireless-edit.html", 
		controller: "networkDeviceWirelessEdit", 
		replace: true
	};
})
.controller("networkDeviceWirelessEdit", function($scope){
	
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("overviewWidget00Wifi", function(){
	return {
		templateUrl: "widgets/overview.wifi.html", 
		controller: "overviewWidgetWifi", 
		replace: true
	 };  
})
.directive("overviewStatusWidget00Wifi", function(){
	return {
		templateUrl: "widgets/overview.wifi.small.html", 
		controller: "overviewStatusWidgetWifi", 
		replace: true
	 };  
})
.controller("overviewStatusWidgetWifi", function($scope, $uci, $rpc){
	JUCI.interval.repeat("overview-wireless", 1000, function(done){
		async.series([function(next){
			$uci.$sync(["wireless"]).done(function(){
				$scope.wireless = $uci.wireless;  
				if($uci.wireless && $uci.wireless.status) {
					if($uci.wireless.status.wlan.value){
						$scope.statusClass = "text-success"; 
					} else {
						$scope.statusClass = "text-default"; 
					}
				}
				$scope.$apply(); 
				next(); 
			}); 
		}, function(next){
			if(!$rpc.juci.wireless) { next(); return; }
			$rpc.juci.wireless.clients().done(function(result){
				$scope.done = 1; 
				var clients = {}; 
				Object.keys(result.clients).map(function(k){ 
					result.clients[k].map(function(x){
						var freq = Math.floor(x.frequency / 100) / 10; 
						if(!clients[freq]) clients[freq] = []; 
						clients[freq].push(x); 
					}); 
				}); 
				$scope.wifiClients = clients; 
				$scope.wifiBands = Object.keys(clients); 
				$scope.$apply(); 
			}); 
		}], function(){
			done(); 
		}); 
	}); 
	
})
.controller("overviewWidgetWifi", function($scope, $rpc, $uci, $tr, gettext, $juciDialog){
	$scope.wireless = {
		clients: []
	}; 
	$scope.wps = {}; 
	
	$scope.onWPSToggle = function(){
		$uci.wireless.status.wps.value = !$uci.wireless.status.wps.value; 
		$scope.wifiWPSStatus = (($uci.wireless.status.wps.value)?gettext("on"):gettext("off")); 
		$uci.$save().done(function(){
			refresh(); 
		}); 
	}
	$scope.onWIFISchedToggle = function(){
		$uci.wireless.status.schedule.value = !$uci.wireless.status.schedule.value; 
		$scope.wifiSchedStatus = (($uci.wireless.status.schedule.value)?gettext("on"):gettext("off")); 
		$uci.$save().done(function(){
			refresh(); 
		}); 
	}

	$scope.onEditSSID = function(iface){
		$juciDialog.show("wireless-interface-edit", {
			title: $tr(gettext("Edit wireless interface")),  
			buttons: [
				{ label: $tr(gettext("Save")), value: "save", primary: true },
				{ label: $tr(gettext("Cancel")), value: "cancel" }
			],
			on_button: function(btn, inst){
				if(btn.value == "cancel"){
					iface.uci_dev.$reset();
					inst.dismiss("cancel");
				}
				if(btn.value == "save"){
					inst.close();
				}
			},
			model: iface.uci_dev
		}).done(function(){

		});
	}

	function refresh() {
		var def = $.Deferred(); 
		$scope.wifiSchedStatus = gettext("off"); 
		$scope.wifiWPSStatus = gettext("off"); 
		async.series([
			function(next){
				$uci.$sync("wireless").done(function(){
					if(!$rpc.juci.wireless) { next(); return; }
					$rpc.juci.wireless.devices().done(function(result){
						$scope.vifs = $uci.wireless["@wifi-iface"].map(function(iface){
							var dev = result.devices.find(function(dev){
								return iface.ifname.value == dev.device; 
							}); 
							if(!dev) return null;
							dev.uci_dev = iface; 
							return dev; 
						}).filter(function(x){ return x != null; }); 
						if($uci.wireless && $uci.wireless.status) {
							$scope.wifiSchedStatus = (($uci.wireless.status.schedule.value)?gettext("on"):gettext("off")); 
							$scope.wifiWPSStatus = (($uci.wireless.status.wps.value)?gettext("on"):gettext("off")); 
						}
					}).always(function(){ next(); }); 
				}); 
			}, 
			function(next){
				/*$rpc.juci.wireless.wps.showpin().done(function(result){
					$scope.wps.pin = result.pin; 
				}).always(function(){ next(); });*/
				next(); 
			}, 
			function(next){
				if(!$rpc.juci.wireless) { next(); return; }	
				$rpc.juci.wireless.clients().done(function(clients){
					$scope.wireless.clients = Object.keys(clients.clients).map(function(k){ return clients.clients[k]; })
						.reduce(function(a, b) { return a.concat(b); }, []); 
					$scope.wireless.clients.map(function(cl){
						// check flags 
						if(!cl.authorized) cl.ipaddr = $tr(gettext("No IP address")); 
					}); 
				}).always(function(){
					next();
				});
			},
		], function(){
			$scope.$apply(); 
			def.resolve(); 
		}); 
		return def.promise(); 
	}; 
	JUCI.interval.repeat("wifi-overview", 10000, function(done){
		refresh().done(function(){
			done(); 
		}); 
	}); 
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("uciWirelessDeviceEdit", function($compile){
	return {
		templateUrl: "/widgets/uci.wireless.device.edit.html", 
		scope: {
			device: "=ngModel"
		}, 
		controller: "WifiDeviceEditController", 
		replace: true, 
		require: "^ngModel"
	 };  
}).controller("WifiDeviceEditController", function($scope, $rpc, $tr, gettext){
	$scope.$watch("device", function onWirelessDeviceModelChanged(device){
		if(!device) return; 
	/*	
		$rpc.juci.wireless.radios().done(function(result){
			if(device[".name"] in result){
				var settings = result[device[".name"]]; 
				$scope.allChannels = [{ label: $tr(gettext("Auto")), value: "auto" }].concat(settings.channels).map(function(x){ return { label: x, value: x }; }); 
				$scope.allModes = [{ label: $tr(gettext("Auto")), value: "auto" }].concat(settings.hwmodes).map(function(x){ return { label: $tr(x), value: x }; }); ; 
				$scope.allBandwidths = settings.bwcaps.map(function(x){ return { label: x, value: x }; }); ; 
			} 
			$scope.$apply(); 
		}); 
	*/		
		$scope.allModes = [
			{ label: "11a", value: "11a" }, 
			{ label: "11b", value: "11b" }, 
			{ label: "11g", value: "11g" }
		]; 

		$rpc.juci.wireless.txpowerlist({ device: $scope.device.ifname.value }).done(function(result){
			if(!result || !result.txpowerlist) return; 
			$scope.allSupportedTxPowers = result.txpowerlist.map(function(x){
				return { label: x.dbm+" dBm ("+x.mw+" mw)", value: x.dbm }; 
			}); 
			$scope.$apply(); 
		}); 

		$rpc.juci.wireless.htmodelist({ device: $scope.device.ifname.value }).done(function(result){
			if(!result || !result.htmodes) return; 
			$scope.allBandwidthModes = Object.keys(result.htmodes).filter(function(k){ return result.htmodes[k]; }).map(function(x){
				return { label: x, value: x }; 
			}); 
			$scope.$apply(); 
		}); 
		
		$rpc.juci.wireless.freqlist({ device: $scope.device.ifname.value }).done(function(result){
			if(!result || !result.channels) return; 
			$scope.allChannels = result.channels.map(function(ch){
				return { label: $tr(gettext("Channel")) + " " + ch.channel + " (" + (ch.mhz / 1000) + "Ghz)", value: ch.channel }; 
			}); 
			$scope.$apply(); 
		}); 

		$rpc.juci.wireless.countrylist({ device: $scope.device.ifname.value }).done(function(result){
			$scope.regChoices = result.countries.sort(function(a, b){
				if(a.name < b.name) return -1; 
				else if(a.name > b.name) return 1; 
				return 0; 
			}).map(function(x){
				return { label: x.name, value: x.ccode }; 
			}); 
			$scope.$apply(); 
		}); 

	}); 
	
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("uciWirelessInterfaceMacfilterEdit", function($compile){
	return {
		templateUrl: "/widgets/uci.wireless.interface.macfilter.edit.html", 
		scope: {
			interface: "=ngModel"
		}, 
		controller: "uciWirelessInterfaceMacfilterEditController", 
		replace: true, 
		require: "^ngModel"
	 };  
}).controller("uciWirelessInterfaceMacfilterEditController", function($scope, $rpc, $uci){
	$scope.maclist = []; 
	
	// watch for model change
	$scope.$watch("interface", function onInterfaceMacfilterModelChanged(i){
		$scope.maclist = []; 
		console.log("Syncing interface.."); 
		if(i.maclist && i.maclist.value){
			i.maclist.value.map(function(mac){
				var added = { hostname: "", macaddr: mac}; 
				$uci.hosts["@all"].map(function(host){
					console.log("testing host "+host.hostname.value); 
					if(host.macaddr.value == mac){
						added = { hostname: host.hostname.value, macaddr: mac}; 
					}
				}); 
				added.maclist = i.maclist; 
				$scope.maclist.push(added); 
			});
			//$scope.$apply();  
		}
	}); 
	
	// watch maclist for changes by the user
	$scope.rebuildMacList = function(){
		if($scope.interface){
			var newlist = $scope.maclist.map(function(x){
				var found = false; 
				console.log("Looking for mac "+x.macaddr); 
				$uci.hosts["@host"].map(function(host){
					if(host.macaddr.value == x.macaddr) {
						console.log("Setting hostname "+x.hostname+" on "+x.macaddr); 
						host.hostname.value = x.hostname; 
						found = true; 
					}
				}); 
				if(!found){
					$uci.hosts.$create({ 
						".type": "host", 
						hostname: x.hostname, 
						macaddr: x.macaddr
					}).done(function(host){
						console.log("Added new host to database: "+host.macaddr.value); 
					}); 
				}
				return x.macaddr || "";  
			}); 
			$scope.interface.maclist.value = newlist;  
		}
	}; 
	
	$rpc.juci.wireless.clients().done(function(clients){
		$scope.client_list = Object.keys(clients)
			.filter(function(k){
				return clients[k].connected; 
			}).map(function(x){ 
			return {
				checked: false, 
				client: clients[x]
			}
		});
		$scope.$apply(); 
	}); 
	
	$scope.onDeleteHost = function(host){
		$scope.maclist = ($scope.maclist||[]).filter(function(x) { 
			return x.macaddr != host.macaddr; 
		}); 
		$scope.interface.maclist.value = 
			$scope.interface.maclist.value.filter(function(x) { 
				return x != host.macaddr; 
			}); 
	}
	
	$scope.onAddClients = function(){
		// reset all checkboxes 
		if($scope.client_list){
			$scope.client_list.map(function(x){ x.checked = false; }); 
		}
		$scope.showModal = 1; 
	}
	
	$scope.onAddNewClient = function(){
		$scope.maclist.push({ hostname: "", macaddr: "" }); 
	}
	
	$scope.onAcceptModal = function(){
		if($scope.client_list && $scope.maclist) {
			$scope.client_list.map(function(x){
				if(x.checked) {
					if($scope.maclist.filter(function(a) { return a.macaddr == x.client.macaddr; }).length == 0){
						$scope.maclist.push({ hostname: x.client.hostname, macaddr: x.client.macaddr }); 
						$scope.rebuildMacList(); 
					} else {
						console.log("MAC address "+x.client.macaddr+" is already in the list!"); 
					}
				}
			}); 
		}
		$scope.showModal = 0; 
	}
	
	$scope.onDismissModal = function(){
		$scope.showModal = 0; 
	}
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.controller("WifiRadioPickerModal", function($scope, $modalInstance, $wireless, interfaces, $tr, gettext){
	$scope.data = {}; 
	$scope.interfaces = interfaces; 
	
	$scope.allModes = [
		{ label: $tr(gettext("Access Point (AP)")), value: "ap" }, 
		{ label: $tr(gettext("Client (STA)")), value: "sta" }
	]; 
	
	$wireless.getDevices().done(function(devices){
		$scope.allRadios = devices.map(function(x){
			return { label: (x[".info"].frequency / 1000) + "Ghz (" + x[".name"] + ")", value: x[".name"] }; 
		}); 
	}); 
  $scope.ok = function () {
		$scope.errors = []; 
		if(($scope.interfaces.find(function(x){ return x.ssid.value == $scope.data.ssid && x.device.value == $scope.data.radio; }) && !confirm(gettext("Are you sure you want to create a new SSID with the same name and on the same radio? This may result in undefined behaviour!")))){
			return;
		} 
		if(!$scope.data.radio){
			$scope.errors.push("Please select a radio!"); 
		} 
		if(!$scope.data.ssid || $scope.data.ssid == ""){
			$scope.errors.push("SSID can not be empty!"); 
		}
		if(!$scope.errors.length) {
			$modalInstance.close($scope.data);
		}
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
})

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("wifiSignalIndicator", function($compile, $parse){
	return {
		templateUrl: "/widgets/wifi.signal.indicator.html", 
		scope: {
			value: "=ngModel"
		}, 
		controller: "wifiSignalIndicator", 
		replace: true, 
		require: "^ngModel"
	 };  
}).controller("wifiSignalIndicator", function($scope, $uci, $rpc){
	$scope.bars = [false, false, false, false]; 
	$scope.$watch("value", function onWirelessSignalIndicatorChanged(value){
		var q = value / 20; 
		$scope.bars[0] = $scope.bars[1] = $scope.bars[2] = $scope.bars[3] = false; 
		if(q > 1) $scope.bars[0] = true; 
		if(q > 2) $scope.bars[1] = true; 
		if(q > 3) $scope.bars[2] = true; 
		if(q > 4) $scope.bars[3] = true; 
	}); 
	$scope.barStyle = function(idx, active){
		var height = 5 + ((idx) * 5); 
		var top = 20 - height; 
		return {
			"position": "absolute", 
			"width": "6px", 
			"height": ""+height+"px", 
			"background-color": (active)?"#5CB85C":"#d5d5d5",
			"top": ""+top+"px", 
			"left": ""+(idx * 8)+"px"
		}; 
	}
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("wirelessApsGraph", function($compile, $parse){
	return {
		templateUrl: "/widgets/wireless-aps-graph.html", 
		scope: {
			scan_list: "=ngModel"
		}, 
		controller: "wirelessApsGraph", 
		replace: true 
	 };  
}).controller("wirelessApsGraph", function($scope){
	var	container = document.getElementById('graph');	
	var items = []; 

	var dataset = new vis.DataSet(items);
	var options = {
		start: 0,
		end: 20,
		style: 'bar',
		drawPoints: {
			onRender: function(item, group, grap2d) {
				return item.label != null;
			},
			style: 'circle'
		}
	};
	
	var groups = new vis.DataSet(); 	
	groups.add({
		id: 1,
		className: 'green',
		options: {
			style:'bar',
			drawPoints: { style: 'circle', size: 10 }
		}
	});
	groups.add({
		id: 2,
		className: 'orange',
		options: {
			style:'bar',
			drawPoints: { style: 'circle', size: 10 }
		}
	});
	groups.add({
		id: 3,
		className: 'red',
		options: {
			style:'bar',
			drawPoints: { style: 'circle', size: 10 }
		}
	});

	var graph2d = new vis.Graph2d(container, dataset, groups, options);

	$scope.$watch("scan_list", function onApsGraphScanlistChanged(value){
		if(!value) return; 		
	
		dataset.remove(dataset.getIds()); 
		value.map(function(ap){
			var group = 1; 
			if(ap.snr < 20) group = 3; 
			else if(ap.snr < 60) group = 2; 
			else group = 1; 
			dataset.add({group: group, x: ap.channel, y: String(ap.snr), label: { content: ap.ssid }}); 
		}); 
	}); 
}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("wirelessClientLanDisplayWidget", function($compile, $parse){
	return {
		templateUrl: "/widgets/wireless-client-lan-display-widget.html", 
		controller: "wirelessClientLanDisplayWidget", 
		scope: {
			client: "=ngModel"
		},
		replace: true, 
		require: "^ngModel"
	 };  
}).controller("wirelessClientLanDisplayWidget", function($scope){	

}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("wirelessInterfaceEdit", function($compile){
	return {
		scope: {
			iface: "=ngModel"
		}, 
		templateUrl: "/widgets/wireless-interface-edit.html", 
		controller: "wirelessInterfaceEdit", 
		replace: true
	 };  
})
.controller("wirelessInterfaceEdit", function($scope, $config, $wireless, $network, $tr, gettext, $uci){
	$scope.errors = []; 
	$scope.showPassword = true; 
	$scope.$on("error", function(ev, err){
		ev.stopPropagation(); 
		$scope.errors.push(err); 
	}); 

	var allSupportedCryptoChoices = [
		{ label: $tr(gettext("None")), value: "none" }, 
		{ label: $tr(gettext("WEP Shared Key")), value: "wep+shared" }, 
		{ label: $tr(gettext("WEP Open System")), value: "wep+open" }, 
		{ label: $tr(gettext("WPA Personal (PSK)")), value: "psk" }, 
		{ label: $tr(gettext("WPA Personal (PSK + TKIP)")), value: "psk+tkip" }, 
		{ label: $tr(gettext("WPA Personal (PSK + CCMP)")), value: "psk+ccmp" }, 
		{ label: $tr(gettext("WPA Personal (PSK + AES)")), value: "psk+aes" }, 
		{ label: $tr(gettext("WPA Personal (PSK + TKIP + CCMP)")), value: "psk+tkip+ccmp" }, 
		{ label: $tr(gettext("WPA Personal (PSK + TKIP + AES)")), value: "psk+tkip+aes" }, 
		{ label: $tr(gettext("WPA2 Personal (PSK)")), value: "psk2" }, 
		{ label: $tr(gettext("WPA2 Personal (PSK + TKIP)")), value: "psk2+tkip" }, 
		{ label: $tr(gettext("WPA2 Personal (PSK + CCMP)")), value: "psk2+ccmp" }, 
		{ label: $tr(gettext("WPA2 Personal (PSK + AES)")), value: "psk2+aes" }, 
		{ label: $tr(gettext("WPA2 Personal (PSK + TKIP + CCMP)")), value: "psk2+tkip+ccmp" }, 
		{ label: $tr(gettext("WPA2 Personal (PSK + TKIP + AES)")), value: "psk2+tkip+aes" }, 
		{ label: $tr(gettext("WPA/WPA2 Personal (PSK) Mixed Mode")), value: "psk-mixed" }, 
		{ label: $tr(gettext("WPA/WPA2 Personal (PSK) Mixed Mode (TKIP)")), value: "psk-mixed+tkip" }, 
		{ label: $tr(gettext("WPA/WPA2 Personal (PSK) Mixed Mode (CCMP)")), value: "psk-mixed+ccmp" }, 
		{ label: $tr(gettext("WPA/WPA2 Personal (PSK) Mixed Mode (AES)")), value: "psk-mixed+aes" }, 
		{ label: $tr(gettext("WPA/WPA2 Personal (PSK) Mixed Mode (TKIP + CCMP)")), value: "psk-mixed+tkip+ccmp" }, 
		{ label: $tr(gettext("WPA/WPA2 Personal (PSK) Mixed Mode (TKIP + AES)")), value: "psk-mixed+tkip+aes" }, 
		{ label: $tr(gettext("WPA2 Enterprise")), value: "wpa2" }, 
		{ label: $tr(gettext("WPA2 Enterprise (TKIP)")), value: "wpa2+tkip" }, 
		{ label: $tr(gettext("WPA2 Enterprise (CCMP)")), value: "wpa2+ccmp" }, 
		{ label: $tr(gettext("WPA2 Enterprise (AES)")), value: "wpa2+aes" }, 
		{ label: $tr(gettext("WPA2 Enterprise (TKIP + CCMP)")), value: "wpa2+tkip+ccmp" }, 
		{ label: $tr(gettext("WPA2 Enterprise (TKIP + AES)")), value: "wpa2+tkip+aes" }, 
		{ label: $tr(gettext("WPA Enterprise")), value: "wpa" }, 
		{ label: $tr(gettext("WPA Enterprise (TKIP)")), value: "wpa+tkip" }, 
		{ label: $tr(gettext("WPA Enterprise (CCMP)")), value: "wpa+ccmp" }, 
		{ label: $tr(gettext("WPA Enterprise (AES)")), value: "wpa+aes" }, 
		{ label: $tr(gettext("WPA Enterprise (TKIP + CCMP)")), value: "wpa+tkip+ccmp" }, 
		{ label: $tr(gettext("WPA Enterprise (TKIP + AES)")), value: "wpa+tkip+aes" }, 
		{ label: $tr(gettext("WPA/WPA2 Enterprise Mixed Mode")), value: "wpa-mixed" },
		{ label: $tr(gettext("WPA/WPA2 Enterprise Mixed Mode (TKIP)")), value: "wpa-mixed+tkip" },
		{ label: $tr(gettext("WPA/WPA2 Enterprise Mixed Mode (CCMP)")), value: "wpa-mixed+ccmp" },
		{ label: $tr(gettext("WPA/WPA2 Enterprise Mixed Mode (AES)")), value: "wpa-mixed+aes" },
		{ label: $tr(gettext("WPA/WPA2 Enterprise Mixed Mode (TKIP + CCMP)")), value: "wpa-mixed+tkip+ccmp" },
		{ label: $tr(gettext("WPA/WPA2 Enterprise Mixed Mode (TKIP + AES)")), value: "wpa-mixed+tkip+aes" }
	]; 

	$scope.cryptoChoices = allSupportedCryptoChoices.filter(function(x){
		if($config.settings.wireless){
			return $config.settings.wireless.cryptochoices.value.indexOf(x.value) >= 0; 
		}
		return true; 
	}); 

	$scope.keyChoices = [
		{label: $tr(gettext("Key")) + " #1", value: 1},
		{label: $tr(gettext("Key")) + " #2", value: 2},
		{label: $tr(gettext("Key")) + " #3", value: 3},
		{label: $tr(gettext("Key")) + " #4", value: 4}
	];

	$scope.psk2_ciphers = [
		{label: $tr(gettext("Auto")), value: "auto"},
		{label: $tr(gettext("CCMP (AES)")), value: "ccmp"}
	]; 

	$scope.mixed_psk_ciphers = [
		{label: $tr(gettext("Auto")), value: "auto"},
		{label: $tr(gettext("CCMP (AES)")), value: "ccmp"},
		{label: $tr(gettext("TKIP/CCMP (AES)")), value: "ccmp"}
	];  

	$network.getNetworks().done(function(nets){
		$scope.networks = nets.map(function(net){
			return { label: String(net[".name"]).toUpperCase(), value: net[".name"] }; 
		}); 
		$scope.$apply(); 
	}); 

	$wireless.getDevices().done(function(devices){
		$scope.devices = devices.map(function(x){
			return { label: x[".frequency"], value: x[".name"] }; 
		}); 
		$scope.$apply(); 
	}); 

	$scope.$watch("iface.closed.value", function onWirelessInterfaceClosedChanged(value, oldvalue){
		if(!$scope.iface) return; 
		if(value && value != oldvalue){
			if($scope.iface.wps_pbc.value && !confirm(gettext("Disabling SSID broadcast will disable WPS. Continue?"))){
				setTimeout(function(){
					$scope.iface.closed.value = oldvalue; 
					$scope.$apply(); 
				},0); 
			} else {
				$scope.iface.wps_pbc.value = false; 
			}
		}
	}); 
	
	$scope.onEncryptionChanged = function(value, oldvalue){
		if(!$scope.iface) return; 
		switch(value){
			case "none": {
				if(oldvalue && value != oldvalue){
					if(!confirm("WARNING: Disabling encryption on your router will severely degrade your security. Are you sure you want to disable encryption on this interface?")){
						setTimeout(function(){
							$scope.iface.encryption.value = oldvalue; 
							$scope.$apply(); 
						},0); 
					}
				}
				break; 
			}
			case "wep": 
			case "wep+shared": {
				if($scope.iface.wps_pbc.value && !confirm(gettext("WPS will be disabled when using WEP encryption. Are you sure you want to continue?"))){
					setTimeout(function(){
						$scope.iface.encryption.value = oldvalue; 
						$scope.$apply(); 
					},0); 
				} else {
					$scope.iface.wps_pbc.value = false; 
				}
				break; 
			}
			case "psk-mixed": {
				if(!$scope.mixed_psk_ciphers.find(function(i){ return i.value == $scope.iface.cipher.value}))
					$scope.iface.cipher.value = "ccmp"; 
				break; 
			}
			case "psk2+ccmp": 
			case "psk2": {
				if(!$scope.psk2_ciphers.find(function(i){ return i.value == $scope.iface.cipher.value}))
					$scope.iface.cipher.value = "ccmp"; 
				break; 
			}
		}; 
	}
	 
	$scope.onPreApply = function(){
		$scope.errors.length = 0; 
	}
	$scope.toggleShowPassword = function(){
		$scope.showPassword = !$scope.showPassword; 
	}

}); 

/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Martin K. Schröder <mkschreder.uk@gmail.com>

	This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/ 

JUCI.app
.directive("wirelessInterfaceEditor", function($compile, $parse){
	return {
		templateUrl: "/widgets/wireless-interface-editor.html", 
		controller: "wirelessInterfaceEditor", 
		replace: true, 
		require: "^ngModel"
	 };  
}).controller("wirelessInterfaceEditor", function($scope, $uci, $wireless, gettext, prompt, $modal){
	$wireless.getInterfaces().done(function(interfaces){
		$wireless.getDevices().done(function(devices){
			$scope.devices = devices; 
			$scope.interfaces = interfaces; 
			var devcounter = {}; 
			$scope.interfaces.map(function(x){
				var dev = devices.find(function(dev) { return dev[".name"] == x.device.value; });  
				if(dev && dev[".info"]) {
					x[".frequency"] = (dev[".info"].frequency/1000)
				}
			}); 
			$scope.$apply(); 
		}); 
	}); 
	
	$scope.getItemTitle = function($item){
		if($item[".info"]) console.log("ITEM: "+Object.keys($item[".info"])); 
		return ($item.ssid.value + ' @ ' + (($item[".info"]||{}).device||"") + ($item[".frequency"]?' (' + $item[".frequency"] + 'Ghz)':"")); 
	}
	
	$scope.onCreateInterface = function(){
		var modalInstance = $modal.open({
			animation: $scope.animationsEnabled,
			templateUrl: 'widgets/wifi-radio-picker-modal.html',
			controller: 'WifiRadioPickerModal',
			resolve: {
				interfaces: function () {
					return $scope.interfaces;
				}
			}
		});

		modalInstance.result.then(function (data) {
			$uci.wireless.$create({
				".type": "wifi-iface",
				"device": data.radio, 
				"ssid": data.ssid
			}).done(function(interface){
				//$scope.interfaces.push(interface); 
				//interface[".frequency"] = interface[".info"].frequency / 1000; 
				$scope.$apply(); 
			}); 
		}, function () {
			console.log('Modal dismissed at: ' + new Date());
		});
	}
	
	$scope.onDeleteInterface = function(conn){
		if(!conn) alert(gettext("Please select a connection in the list!")); 
		if(confirm(gettext("Are you sure you want to delete this wireless interface?"))){
			conn.$delete().done(function(){
				$scope.$apply(); 
			}); 
		}
	}
	
}); 

angular.module('gettext').run(['gettextCatalog', function (gettextCatalog) {
	gettextCatalog.setStrings('en', {"off":"Off","5GHz":"","2.4GHz":"","please pick at least one day to schedule on":"","SSID string can be at most 32 characters long!":"","WEP encryption key #'+id+' must be 10-26 hexadecimal characters!":"","WPA key must be 8-63 characters long!":"","SSID":"","BSSID":"","Channel":"","Frequency":"","Please select a connection in the list!":"","Are you sure you want to delete this wireless interface?":"","auto":"Auto","Access Point (AP)":"","Client (STA)":"","Are you sure you want to create a new SSID with the same name and on the same radio? This may result in undefined behaviour!":"","on":"On","Edit wireless interface":"New interface","No IP address":"","None":"","WEP":"","WPA2 Personal (PSK)":"","WPA Personal (PSK)":"","WPA/WPA2 Personal (PSK) Mixed Mode":"","WPA2 Enterprise":"","WPA Enterprise":"","WPA/WPA2 Enterprise Mixed Mode":"","Key":"","Auto":"","CCMP (AES)":"","TKIP/CCMP (AES)":"","If you disable SSID broadcasting, WPS function will be disabled as well. You will need to enable it manually later. Are you sure you want to continue?":"","WPS will be disabled when using WEP encryption. Are you sure you want to continue?":"","MAC Filtering":"Service Filtering","Access for listed devices":"","Currently added devices":"","Add currently connected hosts to the list":"","Add clients to MAC filtering list":"","Cancel":"","Save":"","You must enter a valid MAC address!":"","Hostname":"","MAC":"","Pick Wireless Radio":"","Pick SSID":"","New SSID":"","Mode":"","New Wireless Interface":"New interface","WiFi":"WiFi","Schedule":"","Enabled":"","Broadcast SSID":"","Encryption":"","Choose Encryption":"","Cipher":"","Reset to default password":"","Choose Key":"","Radius Server":"","wifi-iface.radius_server":"Radius Server","Radius Port":"","wifi-iface.radius_port":"Radius Port","Radius Secret":"","wifi-iface.radius_secret":"Radius Secret","Show Password":"","Wireless":"","Wifi Mode":"","Pick Hardware Mode":"","Bandwidth":"","Pick Bandwidth":"","Pick Channel":"","RIFS":"","RIFS Advertisement":"","Framebursting":"","Beamforming":"","OBSS Co-Existence":"","RX Chain PowerSave Quiet Time":"","RX Chain PowerSave PPS":"","Max. Assoc Clients":"","Maximum Assoc Clients":"","Scan Timer":"","Timer Interval":"","Enable WMM Multimedia Extensions":"","Disable WMM Ack":"","Enable WMM UAPSD Power Saving":"","Wireless Radios":"","wifi.radios.info":"This page allows you to configure wireless radios that you have installed on your system. A wireless radio is not the same thing as an access point. Access points are interfaces and each radio can have several interfaces on it. ","WiFi Client Mode":"","wifi.client.info":"Wireless client information","SNR":"","Connect":"","Wireless Interfaces":"Pick Interface","wifi.interfaces.info":"Wireless interfaces are visible to the user in the form of wireless access point names. Each radio can have several SSIDs and each SSID interface can be configured as part of a network bridge or firewall group. ","WiFi Status":"Status","status.wifi.info":"Wireless status information","Scan neighboring APs":"","Scanning...":"","You will not be able to scan 5Ghz band because your 5Ghz wifi radio is configured to use DFS channels":"","General WiFi Settings":"","wifi.general.info":"Your router supports the industry-wide WiFi standards, enabling easy wireless connection of your devices.","Wifi Network":"Network","Scheduled":"","Enable WiFi":"","Enable WiFi On/Off button":"","You have wifi-scheduling enabled. This means that your wifi will be automatically turned on and off based on your schedule settings":"","MAC Filter":"","wifi.macfilter.info":"To make your wireless network more secure, you can specify which devices are allowed to connect. The devices are identified by their MAC address. You can manage up to 32 devices.","wireless.status.info":"This page shows wireless status information. ","Wireless Status":"Status"," {{wldev.device}} ({{wldev.ssid}})":"","wireless.clients.info":"Clients connected to your AP over wireless interfaces. ","Wireless Clients":"Wireless Clients","MAC Address":"","IPv4":"","IPv6":"","Device":"Device","wireless-scan-title":"Scan","menu-wireless-scan-title":"Scan","wireless-interfaces-title":"Wireless Interfaces","wireless-status-simple-title":"Wireless Status","wireless-filtering-title":"Wireless Filtering Setup","wireless-status-title":"Wireless Status","wireless-general-title":"Wireless General Settings","wireless-devices-title":"Wireless Devices Setup","wireless-client-mode-title":"Wireless Client-Mode Setup","wireless-clients-title":"Wireless Clients Status","wireless-title":"WiFi","menu-wireless-interfaces-title":"Interfaces","menu-wireless-status-simple-title":"Status","menu-wireless-filtering-title":"Filtering","menu-wireless-status-title":"Status","menu-wireless-general-title":"General","menu-wireless-devices-title":"Devices","menu-wireless-client-mode-title":"Client Mode","menu-wireless-clients-title":"Clients","menu-wireless-title":"WiFi"});
	gettextCatalog.setStrings('fi', {"Dongle has been disconnected!":"Mokkula on irroitettu!","A new ethernet device has been connected to your router. Do you want to add it to a network?":"Uusi ethernet-laite on kytketty reitittimeen. Haluatko lisätä sen verkkoon?","IP Address must be a valid ipv4 address!":"IP-osoitteen on oltava kelvollinen IPv4-osoite","IPv6 Aaddress must be a valid ipv6 address":"IPv6-Aaddress on oltava kelvollinen ipv6-osoite","Value must be a valid MAC-48 address":"Arvon on oltava oikea MAC-48 osoite","value must be a valid MAC-48 address":"arvon on oltava kelvollinen MAC-48-osoite","Please select a connection in the list!":"Valitse yhteys luettelosta!","Are you sure you want to delete this connection?":"Oletko varma, että haluat poistaa tämän yhteyden?","You need to select a device to add!":"Valitse lisättävä laite!","You need to specify both name and type!":"Määritä nimi ja tyyppi!","Standard":"Normaali","AnyWAN":"AnyWAN","Bridge":"Silta","Static Address":"Kiinteä IP-osoite","DHCP v4":"DHCP IPv4","DHCP v6":"DHCPv6","PPP":"PPP","PPP over Ethernet":"PPP over Ethernet","PPP over ATM":"PPP over ATM","3G (ppp over GPRS/EvDO/CDMA or UTMS)":"3G (GPRS/EvDO/CDMA/UMTS)","QMI (USB modem)":"QMI (USB-modeemi)","NCM (USB modem)":"NCM (USB modeemi)","HNET (self-managing home network)":"HNET (itseohjautuva kotiverkko)","Point-to-Point Tunnel":"Point-to-Point Tunnel","IPv6 tunnel in IPv4":"IPv6 tunnel in IPv4","Automatic IPv6 Connectivity Client":"Automaattinen IPv6 Connectivity Client","IPv6 rapid deployment":"IPv6 rapid deployment","Dual-Stack Lite":"Dual-Stack Lite","PPP over L2TP":"PPP over L2TP","Relayd Pseudo Bridge":"Relayd Pseudo Bridge","GRE Tunnel over IPv4":"GRE Tunnel over IPv4","Ethernet GRE over IPv4":"Ethernet GRE over IPv4","GRE Tunnel over IPv6":"GRE Tunnel over IPv6","Ethernet GRE over IPv6":"Ethernet GRE over IPv6","You need to select a network!":"Valitse verkko!","Try":"Try","Force":"Force","None":"Ei mitään","Auto":"Automaattinen","Disabled":"Pois käytöstä","Are you sure you want to remove device '+dev+' from network '+net['.name']+' and use it in this bridge?":"Oletko varma, että haluat poistaa laitteen '+ dev+' verkosta '+net[.name] +' ja käyttää sitä tämän sillassa?","Please select a device in the list!":"Valitse laite luettelosta!","Are you sure you want to delete this device from bridge?":"Haluatko varmasti poistaa tämän laitteen sillasta?","network.interface.type.none.tab.title":" ","You need to select a host!":"Valitse isäntäkone!","Unknown":"Tuntematon","Network":"Verkko","Cancel":"Peruuta","Network device":"Valitse verkkolaite","Pick network device":"Valitse verkkolaite","Name":"Nimi","Displayname":"Nimi","VLAN Tag":"VLAN Tag","Device":"Laite","Ports":"Portit","Do you want to:":"Haluatko:","Interface Name":"Liitännän Nimi","Interface Type":"Liitännän Tyyppi","Create New Network Interface":"Luo Uusi Verkkoyhteys","Automatic DNS Configuration":"Automaattinen DNS kokoonpano","Primary DNS":"Primary DNS","Primary DNS IP":"Primary DNS IP","Secondary DNS":"Secondary DNS","General":"Yleiset","Bring-Up on Boot":"Bring-Up on Boot","Automatic Default Route":"Automaattinen oletusreititys","network.interface.type.' + (conn.type.value || 'none') +'.tab.title":"","Advanced":"Lisäasetukset","Override MAC Address":"Korvaa MAC osoite","MAC Address":"MAC-osoite","Override MTU":"Override MTU","MTU":"MTU","Custom Delegated IPv6 Prefix":"Custom Delegated IPv6 Prefix","IPv6 Prefix":"IPv6 Etuliite","Configuration Method":"Määritysmenetelmä","Choose Configuration Option":"Valitse Konfiguraatiovaihtoehto","Method":"Method","Status":"Tila","Pick Network":"Valitse verkko","APN":"APN","PIN-code":"PIN-koodi","Dial Number":"Numero","Username":"Käyttäjätunnus","Password":"Salasana","Enable DHCP Broadcast Flag (required for some ISPs)":"Enable DHCP Broadcast Flag (required for some ISPs)","Request IPv6 address":"Request IPv6 address","Request Prefix Length":"Request Prefix Length","Override Link Local ID":"Override Link Local ID","IPv6 Address":"IPv6-osoite","Client ID to send when requesting DHCP":"Client ID to send when requesting DHCP","Client ID":"Asiakas ID","Mode":"Mode","IPv6 Assign":"IPv6: N määrittäminen","Prefix Size":"Prefix Size","IPv4 Assign":"IPv4: N määrittäminen","DNS Name":"DNS-nimi","Select Modem Device":"Valitse modeemilaite","VCI":"VCI","PPPoA VCI":"PPPoA VCI","VPI":"VPI","PPPoA VPI":"PPPoA VPI","Server IP":"Palvelimen IP","IP Address":"IP-osoite","IPv4 Address":"IPv4-osoite","IPv4 Subnet Mask":"IPv4 Aliverkon peite","IPv4 Default Gateway":"IPv4 Oletusyhdyskäytävä","Static IPv6 Address":"Staattinen IPv6-osoite","IPv6 Address Mask":"IPv6 osoitteen peite","Configure As Default Route":"Määritä Oletusreitiksi","IPv6 Default Gateway":"IPv6 oletusyhdyskäytävä","Default IPv6 Gateway":"IPv6 oletusyhdyskäytävä","IPv6 Assigned Prefix Length":"IPv6 Assigned Prefix Length","Assign prefix to downstream hosts":"Assign prefix to downstream hosts","IPv6 Assigned Prefix Hint":"IPv6 Assigned Prefix Hint","Prefix hint":"Prefix hint","IPv4 Settings":"IPv4-asetukset","IPv6 Settings":"IPv6-asetukset","Select Base Device":"Valitse laite","Device ID":"Laite ID","Base Device":"Fyysinen liitäntä","ID":"Tunnus/ID","Select Connected Host":"Valitse Yhdistetty Isäntäkone","Pick a host":"Valitse isäntäkone","LAN":"LAN","WAN":"WAN","ONLINE":"PÄÄLLÄ","OFFLINE":"POIS PÄÄLTÄ","Connections":"Yhteydet","settings.network.info":"Tällä sivulla voi asettaa paikallisen verkko-osoitteen (LAN-IP). Mikäli DHCP on käytössä, reititin jakaa automaattisesti IP-osoitteen paikalliseen verkkoon yhdistetyille laitteille. Staattista DHCP:tä käyttämällä on mahdollista jakaa aina sama IP-osoite halutulle laitteelle.","Default Route":"Oletusreitti","settings.network.default.route.info":"settings.network.default.route.info"," connection will be used as default outgoing route for packets.":"Oletusreitti","Static Routes":"Staattiset Reitit","internet.lan.routes.info":"internet.lan.routes.info","Target IP Address":"Kohteen IP-osoite","Netmask":"Aliverkko","Default Gateway":"Oletysyhdyskäytävä","Interface":"Fyysinen liitäntä","Target":"Kohde","Gateway":"Yhdyskäytävä","Services":"Palvelut","internet.services.info":"Palvelut-sivulla voidaan konfiguroida erilaisia ohjelmia kuten Verkkojakoja ja MiniDLNA","Connected Clients":"Yhdistetyt Langattomat Laitteet","Hostname":"Isäntäkoneen nimi","VLAN Configuration":"VLAN konfiguraatio","status.status.info":"Tällä sivulla on yleisnäkymä laitteen pääparameterista. Tämä voi auttaa sinua optimoimaan modeemisi tai tunnistamaan ongelmia.","Line Status":"Linjan tila","Active Connections":"Aktiivisia yhteyksiä","Connections for each Device":"Laitteiden yhteydet","status.nat.connections.info":"Tämä sivu näyttää kaikkien yhdistettyjen laitteiden yhteydet.","NAT Connection Table":"NAT yhteys-taulukko","status.nat.info":"Tämä sivu näyttää kaikkien yhdistettyjen laitteiden yhteydet.","status.network.routes.info":"Reitit","Routing Status":"Reitityksen tila","ARP Table":"ARP taulu","IP address":"IP-osoite","MAC address":"MAC-osoite","IPv4 Routing Table":"IPv4-reititystaulukko","IPv4 address":"IPv4-osoite","IPv6 Routing Table":"IPv6-reititystaulukko","IPv6 address":"IPv6-osoite","Next Hop":"Next Hop","IPv6 Neighbors Table":"IPv6 Neighbors Table","No IPv6 devices connected":"Ei yhdistettyjä  IPv6-laitteita","IPv6 status":"IPv6-tila","Router":"Reititin","status-network-routes-title":"Reitit","internet-services-title":"Palvelut","internet-network-title":"Verkko","status-network-nat-title":"NAT","netifd-status-clients-title":"Laitteet","netifd-vlan-config-title":"VLAN","status-network-title":"Verkko","internet-routes-title":"Reitit","network-title":"Reitit","menu-status-network-routes-title":"Reitit","menu-internet-services-title":"Palvelut","menu-internet-network-title":"Verkko","menu-status-network-nat-title":"NAT","menu-netifd-status-clients-title":"Laitteet","menu-netifd-vlan-config-title":"VLAN","menu-status-network-title":"Verkko","menu-internet-routes-title":"Reitit","menu-network-title":"Verkko"});
}]);

JUCI.style({"css":"\n\n\n"});
JUCI.template("widgets/network-device-wireless-edit.html", "<div>\n<uci-wireless-interface ng-model=\"device.base\"></uci-wireless-interface>\n</div>\n");JUCI.template("widgets/overview.wifi.html", "<div class=\"panel panel-default\">\n<div class=\"panel-heading\">\n<h3 class=\"panel-title\" style=\"font-size: 1.7em; padding-top: 0.3em; font-weight: bold; font-family: 'eurostyle';\">\n<i class=\"fa fa-wifi\" style=\"margin-right: 10px;\"/>{{'WiFi'|translate}}\n</h3>\n</div>\n<div class=\"panel-body\">\n<div class=\"row\" style=\"margin-bottom: 10px;\">\n<div class=\"col-xs-3\" style=\"text-align: center;\"><i class=\"fa fa-calendar fa-2x\"></i></div>\n<div class=\"col-xs-7\" style=\"padding-left: 0px\">\n<a class=\"overview-list-item-text\" href=\"#!/wifi-schedule\"><strong>{{'Schedule'|translate}}</strong></a>\n</div>\n<div class=\"col-xs-2\">\n<a class=\"label label-{{(wifi.status.schedule.value)?'success':'default'}} pull-right overview-list-item-label\" href=\"\" ng-click=\"onWIFISchedToggle()\"><strong>{{wifiSchedStatus| translate}}</strong></a>\n</div>\n</div>\n<div class=\"row\" style=\"margin-bottom: 10px;\">\n<div class=\"col-xs-3\" style=\"text-align: center;\"><i class=\"fa fa-wifi fa-2x\"></i></div>\n<div class=\"col-xs-7\" style=\"padding-left: 0px\">\n<a class=\"overview-list-item-text\" href=\"#!/wifi-wps\"><strong>WPS</strong></a><br/>\n</div>\n<div class=\"col-xs-2\">\n<a class=\"label label-{{(wifi.status.wps.value)?'success':'default'}} pull-right overview-list-item-label\" href=\"\" ng-click=\"onWPSToggle()\"><strong>{{wifiWPSStatus | translate}}</strong></a>\n</div>\n</div>\n<div class=\"row\">\n<div class=\"col-xs-12\">\n<table class=\"table table-condensed\">\n<tr>\n<td><strong translate>WPS pin:</strong></td>\n<td style=\"text-align: right;\"><span ng-show=\"wifi.status.wps.value\" style=\"font-size: 0.8pn\">{{wps.pin || \"-\"}}</span></td>\n</tr>\n</table>\n<table class=\"table table-condensed\" ng-repeat=\"iface in vifs track by $index\">\n<thead>\n<th colspan=\"2\">\n<i class=\"fa fa-edit\" style=\"float: right; cursor: pointer;\" ng-click=\"onEditSSID(iface)\"></i>\n<i class=\"fa fa-toggle-right\" style=\"cursor: pointer;\" ng-show=\"!iface._expanded\" ng-click=\"iface._expanded = !iface._expanded\"></i>\n<i class=\"fa fa-toggle-down\" style=\"cursor: pointer;\" ng-show=\"iface._expanded\" ng-click=\"iface._expanded = !iface._expanded\"></i>\n<span ng-click=\"iface._expanded = !iface._expanded\" style=\"cursor: pointer;\">{{iface.ssid + ' (' + iface.mode + ')'}}</span>\n</th>\n</thead>\n<tr ng-show=\"iface._expanded\" ng-repeat=\"i in [['Frequency', 'frequency'], ['Channel', 'channel'], ['Noise', 'noise']]\">\n<td><strong translate>{{i[0] | translate}}</strong></td>\n<td style=\"font-size: 0.8pn; text-align: right;\">{{iface[i[1]] || \"-\"}}</td>\n</tr>\n<tr><td></td><td></td></tr><!-- an extra line as quick way to get a border after the last line -->\n</table>\n</div>\n</div>\n</div>\n</div>\n");JUCI.template("widgets/overview.wifi.small.html", "<div>\n<table>\n<tr>\n<td style=\"width:1%\"><i class=\"fa fa-wifi\"></i></td>\n<td style=\"padding-left: 10px;\">{{'Wireless'|translate}}</td>\n<td style=\"width:1%; white-space: nowrap; \">\n<span ng-show=\"wifiBands.length\" ng-repeat=\"band in wifiBands track by $index\" class=\"badge\">{{band}}Ghz: {{wifiClients[band].length}}</span>\n<span ng-show=\"wifiBands.length == 0\" class=\"badge\">0</span>\n<i class=\"fa fa-spinner fa-spin\" ng-show=\"!wifiClients\"></i>\n</td>\n</tr>\n</table>\n</div>\n");JUCI.template("widgets/uci.wireless.device.edit.html", "<div>\n<juci-config-lines>\n<juci-config-line title=\"{{'Enabled'|translate}}\" help=\"{{'Turn this wireless radio on/off'|translate}}\">\n<switch ng-model=\"device.disabled.value\" class=\"green\" inverted/>\n</juci-config-line>\n<juci-config-line title=\"{{'Regulatory Domain'|translate}}\" help=\"{{'Pick your country to comply with local regulations'|translate}}\">\n<juci-select ng-model=\"device.country.value\" ng-items=\"regChoices\"></juci-select>\n</juci-config-line>\n<!--<juci-config-line title=\"{{'HW Mode'|translate}}\" help=\"{{'Hardware Mode'|translate}}\">\n<juci-select ng-model=\"device.hwmode.value\" ng-items=\"allModes\" placeholder=\"{{'Pick Hardware Mode'|translate}}\"/>\n</juci-config-line>-->\n<juci-config-line title=\"{{'TX Power'|translate}}\" help=\"{{'Maximum tx power'|translate}}\">\n<juci-select ng-model=\"device.txpower.value\" ng-items=\"allSupportedTxPowers\" placeholder=\"{{'Pick TX power'|translate}}\"></juci-select>\n</juci-config-line>\n<juci-config-line title=\"{{'Bandwidth Mode'|translate}}\" help=\"{{'Bandwidth mode (higher = faster theoretical throughput)'|translate}}\">\n<juci-select ng-model=\"device.htmode.value\" ng-items=\"allBandwidthModes\" placeholder=\"{{'Pick Bandwidth Mode'|translate}}\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'Channel'|translate}}\" help=\"{{'Channel to be used for this radio'|translate}}\">\n<juci-select ng-model=\"device.channel.value\" ng-items=\"allChannels\" placeholder=\"{{'Pick Channel'|translate}}\"/>\n</juci-config-line>\n</juci-config-lines>\n</div>\n\n");JUCI.template("widgets/uci.wireless.interface.macfilter.edit.html", "<div>\n<juci-config-lines>\n<juci-config-line title=\"{{'MAC Filtering'|translate}}\">\n<switch ng-model=\"interface.macfilter.value\" class=\"green\"></switch>\n</juci-config-line>\n</juci-config-lines>\n<div ng-show=\"interface.macfilter.value\">\n<!--<div class=\"alert alert-danger\">\n<div ng-message=\"pattern\" translate><span class=\"glyphicon glyphicon-exclamation-sign\" aria-hidden=\"true\"></span>You must enter a valid MAC address!</div>\n</div>-->\n<juci-config-lines>\n<juci-config-line title=\"{{'Access for listed devices'|translate}}\">\n<div class=\"btn-group\">\n<button ng-repeat=\"mode in [[1,'allow'], [2, 'deny']]\" class=\"btn btn-default\" ng-model=\"interface.macmode.value\" btn-radio=\"mode[0]\">{{ 'interface.macmode.'+mode[1] | translate}}</button>\n</div>\n</juci-config-line>\n<juci-config-line title=\"{{'Currently added devices'|translate}}\">\n<div class=\"row\" ng-repeat=\"mac in maclist track by $index\">\n<div class=\"col-md-5 form-group\">\n<label class=\"visible-xs visible-sm\" translate>Hostname</label>\n<input type=\"text\" class=\"form-control\" ng-model=\"mac.hostname\" ng-blur=\"rebuildMacList()\"/>\n</div>\n<div class=\"col-md-5 form-group\">\n<label class=\"visible-xs visible-sm\" translate>MAC</label>\n<input type=\"text\" class=\"form-control\" ng-model=\"mac.macaddr\" ng-blur=\"rebuildMacList()\" placeholder=\"xx:xx:xx:xx:xx:xx\" /><!-- ng-pattern=\"/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/\"-->\n</div>\n<div class=\"col-md-2\">\n<button class=\"btn btn-default pull-right\" ng-click=\"onDeleteHost(mac)\"><i class=\"fa fa-trash-o\"></i></button>\n<br style=\"clear: both;\"/>\n</div>\n<div class=\"col-xs-12\"><hr/></div>\n</div>\n<div class=\"row\">\n<div class=\"col-md-4 col-md-offset-8\">\n<button class=\"btn btn-default pull-right\" ng-click=\"onAddNewClient()\"><i class=\"fa fa-plus\"></i></button>\n</div>\n</div>\n</juci-config-line>\n<juci-config-line title=\"{{'Add currently connected hosts to the list'|translate}}\">\n<button class=\"btn btn-default pull-right\" ng-click=\"onAddClients()\"><i class=\"fa fa-plus\"></i></button>\n</juci-config-line>\n</juci-config-lines>\n</div>\n<modal title=\"{{'Add clients to MAC filtering list'|translate}}\" ng-show=\"showModal\" on-accept=\"onAcceptModal()\" on-dismiss=\"onDismissModal()\" dismiss-label=\"{{'Cancel'|translate}}\" accept-label=\"{{'Save'|translate}}\">\n<div class=\"row\" ng-repeat=\"cl in client_list track by $index\">\n<div class=\"col-xs-6\">\n<div class=\"checkbox checkbox-small checkbox-info\">\n<input type=\"checkbox\" ng-model=\"cl.checked\"/>\n<label><strong>{{cl.client.hostname}}</strong></label>\n</div>\n</div>\n<div class=\"col-xs-6\" style=\"margin-top: 5px;\">\n<label>{{cl.client.macaddr}}</label>\n</div>\n</div>\n</modal>\n</div>\n\n");JUCI.template("widgets/wifi-radio-picker-modal.html", "<div>\n<div class=\"modal-header\">\n<h3 class=\"modal-title\" translate>New Wireless Interface</h3>\n</div>\n<div class=\"modal-body\">\n<juci-config-lines>\n<juci-config-line title=\"{{'Pick Wireless Radio'|translate}}\">\n<juci-select ng-model=\"data.radio\" ng-items=\"allRadios\" placeholder=\"Select Wireless Radio\"></juci-select>\n</juci-config-line>\n<juci-config-line title=\"{{'Pick SSID'|translate}}\">\n<input type=\"text\" class=\"form-control\" ng-model=\"data.ssid\" placeholder=\"{{'New SSID'|translate}}\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'Mode'|translate}}\">\n<juci-select ng-model=\"data.mode\" ng-items=\"allModes\" placeholder=\"Select Interface Mode\"></juci-select>\n</juci-config-line>\n</juci-config-lines>\n<div class=\"alert alert-danger\" ng-show=\"errors.length\">\n<ul>\n<li ng-repeat=\"err in errors track by $index\">{{err}}</li>\n</ul>\n</div>\n</div>\n<div class=\"modal-footer\">\n<button class=\"btn btn-primary\" ng-click=\"ok()\">OK</button>\n<button class=\"btn btn-default\" ng-click=\"cancel()\">Cancel</button>\n</div>\n</div>\n");JUCI.template("widgets/wifi.signal.indicator.html", "<div style=\"position: relative; float: right; left: -30px;\">\n<div ng-repeat=\"bar in bars track by $index\" ng-style=\"barStyle($index, bar)\"></div>\n</div>\n\n");JUCI.template("widgets/wireless-aps-graph.html", "<div>\n<div id=\"graph\" class=\"wifi-aps-graph\">\n\n</div>\n</div>\n");JUCI.template("widgets/wireless-client-lan-display-widget.html", "<div style=\"position:relative;\">\n<div class=\"col-xs-2\"><i class=\"fa fa-laptop fa-2x\"></i></div>\n<div class=\"col-xs-8\">{{client.hostname}}<br ng-show=\"client.hostname\"/>{{client.ipaddr}}<br ng-show=\"client.ip6addr\"/>{{client.ip6addr}}</div>\n<div class=\"col-xs-2\" style=\"color: #a9b400;\">\n<wifi-signal-indicator ng-model=\"client._wireless.snr\"></wifi-signal-indicator>\n</div>\n<div style=\"position: absolute;top: 25px;right: 12px;font-size: 10px;\">{{client._wireless.band}}</div>\n</div>\n");JUCI.template("widgets/wireless-interface-edit.html", "<div>\n<juci-config-lines>\n<juci-config-line title=\"{{'Enabled'|translate}}\" help=\"{{'Turn this wireless network on/off'|translate}}\">\n<switch ng-model=\"iface.disabled.value\" class=\"green\" inverted></switch>\n</juci-config-line>\n</juci-config-lines>\n<juci-config-lines ng-hide=\"iface.disabled.value\">\n<juci-config-line title=\"{{'SSID'|translate}}\" help=\"{{'Wireless network ID'|translate}}\">\n<input type=\"text\" class=\"form-control\" placeholder=\"Wifi Name\" ng-model=\"iface.ssid.value\" maxlength=\"32\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'Broadcast SSID'|translate}}\" help=\"{{'Disable to hide SSID'|translate}}\">\n<switch id=\"enabled\" name=\"enabled\" ng-model=\"iface.hidden.value\" on-change=\"onShowSSIDToggle()\" class=\"green\" inverted></switch>\n</juci-config-line>\n<juci-config-line title=\"{{'Encryption'|translate}}\" help=\"{{'Choose between supported encryption modes and cyphers'|translate}}\">\n<juci-select ng-model=\"iface.encryption.value\" ng-items=\"cryptoChoices\" placeholder=\"{{'Choose Encryption'|translate}}\" on-change=\"onEncryptionChanged($value, $oldvalue)\"/>\n</juci-config-line>\n<div ng-show=\"iface.encryption.value.indexOf('psk') == 0\">\n<juci-config-line title=\"{{'Key'|translate}}\" help=\"{{'Preshared key/passphrase'|translate}}\">\n<div class=\"input-group\">\n<input type=\"{{(!showPassword)?'password':'text'}}\" class=\"form-control\" placeholder=\"{{'Key'|translate}}\" ng-model=\"iface.key.value\" />\n<span style=\"cursor: pointer;\" title=\"{{'Reset to default password'|translate}}\" class=\"input-group-addon\" id=\"basic-addon1\" ng-click=\"iface.key.value = default_key\"><i class=\"fa fa-rotate-left\"></i></span>\n</div>\n<div class=\"checkbox checkbox-info\">\n<input type=\"checkbox\" ng-model=\"showPassword\" ng-click=\"toggleShowPassword()\"/>\n<label><strong>{{'Show Password'|translate}}</strong></label>\n</div>\n</juci-config-line>\n</div>\n<div ng-show=\"iface.encryption.value.indexOf('wep') == 0\">\n<juci-config-line title=\"{{'Key'|translate}}\" help=\"{{'Primary key index'|translate}}\">\n<juci-select ng-model=\"iface.key_index.value\" ng-items=\"keyChoices\" placeholder=\"{{'Choose Key'|translate}}\"/>\n</juci-config-line>\n<juci-config-line ng-repeat=\"key in ['1', '2', '3', '4']\" \ntitle=\"{{'Key'|translate}} {{key}}\">\n<input type=\"{{(!showPassword)?'password':'text'}}\" class=\"form-control\" placeholder=\"{{('Key'+key)|translate}}\" ng-model=\"iface['key'+key].value\" />\n</juci-config-line>\n<juci-config-line>\n<div class=\"checkbox checkbox-info\">\n<input type=\"checkbox\" ng-model=\"showPassword\" ng-click=\"toggleShowPassword()\"/>\n<label><strong>{{'Show Password'|translate}}</strong></label>\n</div>\n</juci-config-line>\n</div>\n<div ng-show=\"iface.encryption.value.indexOf('wpa2') == 0\">\n<juci-config-line title=\"{{'Radius Server'|translate}}\" help=\"{{'RADIUS server address'|translate}}\">\n<input type=\"text\" class=\"form-control\" placeholder=\"{{'wifi-iface.radius_server'|translate}}\" ng-model=\"iface.radius_server.value\" />\n</juci-config-line>\n<juci-config-line title=\"{{'Radius Port'|translate}}\" help=\"{{'RADIUS port number'|translate}}\">\n<input type=\"text\" class=\"form-control\" placeholder=\"{{'wifi-iface.radius_port'|translate}}\" ng-model=\"iface.radius_port.value\" />\n</juci-config-line>\n<juci-config-line title=\"{{'Radius Secret'|translate}}\" help=\"{{'RADIUS authentication secret'|translate}}\">\n<input type=\"{{(!showPassword)?'password':'text'}}\" class=\"form-control\" placeholder=\"{{'wifi-iface.radius_secret'|translate}}\" ng-model=\"iface.radius_secret.value\" />\n</juci-config-line>\n</div>\n</juci-config-lines>\n</div>\n");JUCI.template("widgets/wireless-interface-editor.html", "<div>\n<juci-list-editor ng-items=\"interfaces\" item-editor=\"wireless-interface-edit\" on-create=\"onCreateInterface()\" on-delete=\"onDeleteInterface($item)\" get-item-title=\"getItemTitle($item)\" ></juci-list-editor>\n</div>\n");JUCI.template("pages/wireless-client-mode.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessClientModePage\">\n<juci-config-heading>{{ 'WiFi Client Mode' | translate }}</juci-config-heading>\n<juci-config-info>{{ 'wifi.client.info' | translate }}</juci-config-info>\n<i class=\"fa fa-spinner fa-spin\" ng-hide=\"access_points\"></i>\n<table class=\"table\" ng-show=\"access_points\">\n<thead>\n<th translate>SSID</th>\n<th translate>SNR</th>\n<th translate>Cipher</th>\n<th translate>Connect</th>\n</thead>\n<tr ng-repeat=\"ap in access_points track by $index\">\n<td>{{ap.ssid}}</td>\n<td>{{ap.snr}}</td>\n<td>{{ap.cipher}}</td>\n<td>\n<button class=\"btn btn-default\">Connect</button>\n</td>\n</tr>\n</table>\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless-clients.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessClientsPage\">\n<h2 translate>Wireless Clients</h2>\n<juci-config-info>{{'wireless.clients.info'|translate}}</juci-config-info>\n<table class=\"table\">\n<thead>\n<th translate>IP-Address</th>\n<th translate>MAC</th>\n<th translate>Quality</th>\n<th translate>Counters TX/RX</th>\n<th translate>Radio</th>\n</thead>\n<tr ng-repeat=\"cl in clients track by $index\">\n<td style=\"white-space: nowrap;\">IPv4: {{cl.ipaddr || '-'}}<br/>IPv6: {{cl.ip6addr||'-'}}</td>\n<td>{{cl.macaddr}}</td>\n<td style=\"white-space: nowrap;\">{{'Signal'|translate}}: {{cl._wireless.signal}} dBm<br/>{{'Noise'|translate}}: {{cl._wireless.noise}} dBm<br/>\nSNR: {{cl._wireless.signal - cl._wireless.noise}} dBm</td>\n<td style=\"white-space: nowrap;\">\n{{'PHY-Rate'|translate}}: {{cl._wireless.rx_rate}} / {{cl._wireless.tx_rate}} Mbps<br/>\n{{'Packets'|translate}}: {{cl._wireless.rx_packets}} / {{cl._wireless.tx_packets}} <br/>\n{{'Last Activity'|translate}}: {{cl._wireless.inactive / 1000}} Sec</td>\n<td>{{cl._wireless.wldev}}</td>\n</tr>\n</table>\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless-devices.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessDevicesPage\">\n<juci-config-section title=\"{{'Wireless Radios'|translate}}\">\n<juci-config-info>{{ 'wifi.radios.info' | translate }}</juci-config-info>\n<div ng-if=\"misconfigured\" class=\"alert alert-danger\" translate>One or more radios is misconfigured in UCI. All radios should have an ifname parameter set which binds configuration to actual radio!</div>\n<juci-list-editor ng-items=\"devices\" item-editor=\"uci-wireless-device-edit\" \non-create=\"onCreateDevice()\" on-delete=\"onDeleteDevice($item)\" \nget-item-title=\"$item['.name'] + ' (' + ($item['.info'].frequency/1000) + 'Ghz)'\" allow-edit=\"false\"></juci-list-editor>\n</juci-config-section>\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless-filtering.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessFilteringPage\">\n<juci-config-heading>{{ 'MAC Filter' | translate }}</juci-config-heading>\n<juci-config-info>{{ 'wifi.macfilter.info' | translate }}</juci-config-info>\n<juci-config-section title=\"{{ iface.ssid.value }} ({{iface['.frequency']}})\" ng-show=\"interfaces && interfaces.length != 0\" ng-repeat=\"iface in interfaces track by $index\">\n<uci-wireless-interface-macfilter-edit ng-model=\"iface\"></uci-wifi-iface-macfilter-edit>\n</juci-config-section>\n<!--<juci-config-section>\n<juci-config-heading>str.guest.wifi</juci-config-heading>\n<uci-wireless-interface-macfilter-edit ng-model=\"guest_wifi\"></uci-wifi-iface-macfilter-edit>\n</juci-config-section>-->\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless-general.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessGeneralPage\">\n<div ng-hide=\"status\">\n<i class=\"fa fa-spinner fa-spin fa-2x\"></i>\n</div>\n<juci-config-section title=\"{{'General WiFi Settings'|translate}}\" ng-show=\"status\">\n<juci-config-info>{{ 'wifi.general.info' | translate }}</juci-config-info>\n<div class=\"alert alert-warning\" ng-show=\"status.schedule.value\">\n<p translate>You have wifi-scheduling enabled. This means that your wifi will be automatically turned on and off based on your schedule settings</p>\n</div>\n<juci-config-lines>\n<juci-config-line title=\"{{'Wifi Network'|translate}}\" ng-show=\"status.schedule.value\">\n<a href=\"#!wireless-schedule\"><strong>{{'Scheduled'|translate}}</strong></a>\n</juci-config-line>\n<juci-config-line title=\"{{'Enable WiFi'|translate}}\" ng-hide=\"status.schedule.value\">\n<switch ng-model=\"status.wlan.value\" class=\"green\"></switch>\n</juci-config-line>\n<!--<juci-config-line title=\"{{'Enable WiFi On/Off button'|translate}}\" ng-show=\"router\">\n<switch ng-model=\"router.wifi_button_enabled\" class=\"green\"></switch>\n</juci-config-line>-->\n</juci-config-lines>\n</juci-config-section>\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless-interfaces.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessInterfacesPage\">\n<juci-config-heading>{{ 'Wireless Interfaces' | translate }}</juci-config-heading>\n<juci-config-info>{{ 'wifi.interfaces.info' | translate }}</juci-config-info>\n<wireless-interface-editor></wireless-interface-editor>\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless-scan.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessScanPage\">\n<juci-config-heading>{{ 'Wireless Scan Results' | translate }}</juci-config-heading>\n<juci-config-info>{{ 'Scan your neighborhood for other wireless access points.' | translate }}</juci-config-info>\n<div ng-show=\"!results\">\n<p translate>No scan results yet. Press scan button to start a scan.</p>\n<button ng-disabled=\"scanning\" class=\"btn btn-default\" ng-click=\"onScan()\"><i class=\"fa fa-spinner fa-spin\" ng-show=\"scanning\"></i>{{'Scan'|translate}}</button>\n</div>\n<table class=\"table table-bordered\" ng-show=\"results\">\n<thead>\n<th translate>SSID</th>\n<th translate>Channel</th>\n<th translate>Encryption</th>\n<th translate>Quality</th>\n</thead>\n<tbody>\n<tr ng-repeat=\"ap in results\">\n<td>{{ap.ssid}}</td>\n<td>{{ap.channel}}</td>\n<td>{{ap.encryption.description}}</td>\n<td>\n<progressbar type=\"success\" value=\"ap.quality\">{{ap.quality}}</progressbar>\n</td>\n</tr>\n</tbody>\n</table>\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless-status-simple.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessStatusSimplePage\">\n<h2 translate>Wireless Status</h2>\n<juci-config-info>{{'wireless.status.info'|translate}}</juci-config-info>\n<div ng-repeat=\"wldev in devices track by $index\">\n<h2>{{wldev.ssid}} ({{wldev.device}}) </h2>\n<table class=\"table\">\n<tr ng-repeat=\"line in wldev._table track by $index\"><td>{{line[0]}}</td><td>{{line[1]}}</td></tr>\n</table>\n</div>\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless-status.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"wirelessStatusPage\">\n<juci-config-heading>{{ 'WiFi Status' | translate }}</juci-config-heading>\n<juci-config-info>{{ 'status.wifi.info' | translate }}</juci-config-info>\n<juci-config-lines>\n<juci-config-line title=\"{{'Scan neighboring APs'|translate}}\">\n<button ng-disabled=\"scanning\" ng-click=\"doScan()\" class=\"btn btn-default\">\n<span ng-show=\"!scanning\">Scan</span>\n<span ng-show=\"scanning\"><i class=\"fa fa-spinner fa-spin\"></i> <span translate>Scanning...</span></span>\n</button>\n</juci-config-line>\n</juci-config-lines>\n<div ng-show=\"dfs_enabled\" class=\"alert alert-info\" translate>You will not be able to scan 5Ghz band because your 5Ghz wifi radio is configured to use DFS channels</div> \n<wireless-aps-graph ng-model=\"access_points\"></wireless-aps-graph>\n<table class=\"table\">\n<thead>\n<th><a href=\"\" ng-click=\"order('ssid')\" translate>SSID</a></th>\n<th><a href=\"\" ng-click=\"order('frequency')\" translate>Frequency</a></th>\n<th><a href=\"\" ng-click=\"order('channel')\" translate>Channel</a></th>\n<th><a href=\"\" ng-click=\"order('rssi')\" translate>RSSI</a></th>\n<th><a href=\"\" ng-click=\"order('noise')\" translate>Noise</a></th>\n<th><a href=\"\" ng-click=\"order('cipher')\" translate>Cipher</a></th>\n<th><a href=\"\" ng-click=\"order('wps_version')\" translate>WPS</a></th>\n</thead>\n<tr ng-repeat=\"ap in access_points track by $index | orderBy:predicate:reverse\">\n<td>{{ap.ssid}}</td>\n<td>{{ap.frequency}}</td>\n<td>{{ap.channel}}</td>\n<td>{{ap.rssi}}</td>\n<td>{{ap.noise}}</td>\n<td>{{ap.cipher}}</td>\n<td>{{ap.wps_version}}</td>\n</tr>\n</table>\n</div>\n</juci-layout-with-sidebar>\n");JUCI.template("pages/wireless.html", "");