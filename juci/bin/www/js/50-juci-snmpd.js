
//! Author: Martin K. Schröder <mkschreder.uk@gmail.com>
//! Copyright 2015 (c) Martin K. Schröder

UCI.$registerConfig("snmpd"); 
UCI.snmpd.$registerSectionType("mini_snmpd", {
	"enabled":			{ dvalue: false, type: Boolean }, 	
	"community":		{ dvalue: "", type: String }, 	
	"location":			{ dvalue: "", type: String }, 	
	"contact":			{ dvalue: "", type: String }, 	
	"disks":			{ dvalue: "", type: String }, 	
	"interfaces":		{ dvalue: "", type: String }, 	
	"manager_ip":		{ dvalue: "", type: String }, 	
	"name":				{ dvalue: "", type: String }, 	
	"read_community": 	{ dvalue: "", type: String }, 	
	"set_community": 	{ dvalue: "", type: String }
}); 

UCI.snmpd.$registerSectionType("system", {
	"enabled":			{ dvalue: "", type: String },
	"contact":			{ dvalue: "", type: String }, 	
	"manager_ip":		{ dvalue: "", type: String }, 	
	"read_community": 	{ dvalue: "", type: String }, 	
	"set_community": 	{ dvalue: "", type: String },
	"sysLocation": 		{ dvalue: "", type: String }, 
	"sysName":	 		{ dvalue: "", type: String }, 
	"sysContact": 		{ dvalue: "", type: String }, 
	"sysDescr": 		{ dvalue: "", type: String } 
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
.controller("SnmpConfigPage", function($scope, $uci, gettext){
	$uci.$sync("snmpd").done(function(){
		if(!$uci.snmpd._exists) {
			$scope.snmpd_not_installed = true; 
			$scope.$apply(); 
			return; 
		}
		$scope.config = $uci.snmpd["@system"][0]; 
		$scope.$apply(); 
	}); 
}); 

angular.module('gettext').run(['gettextCatalog', function (gettextCatalog) {
	gettextCatalog.setStrings('en', {"SNMPD Configuration":"","snmpd.config.info":"Configuration for Simple Network Management Protocol service (snmpd)","Enabled":"","Read Community":"","Community":"","Set Community":"","System Name":"","Name":"","System Location":"","Location":"","System Contact":"","E-Mail":"","Trap Manager IP":"","snmpd-config-title":"SNMP Configuration","menu-snmpd-config-title":"SNMP"});
}]);

JUCI.style({"css":"\n\n\n"});
JUCI.template("pages/snmpd-config.html", "<juci-layout-with-sidebar>\n<div ng-controller=\"SnmpConfigPage\">\n<juci-config-heading>{{'SNMPD Configuration'|translate}}</juci-config-heading>\n<juci-config-info>{{'snmpd.config.info'|translate}}</juci-config-info>\n<div ng-if=\"snmpd_not_installed\" class=\"alert alert-danger\" translate>SNMP is not installed on this system</div>\n<div ng-if=\"!snmpd_not_installed\">\n<juci-config-section title=\"{{'General Settings'|translate}}\">\n<juci-config-lines>\n<juci-config-line title=\"{{'Enabled'|translate}}\">\n<switch ng-model=\"config.enabled.value\" class=\"green\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'Read Community'|translate}}\">\n<input type=\"text\" ng-model=\"config.read_community.value\" class=\"form-control\" placeholder=\"{{'Community'|translate}}\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'Set Community'|translate}}\">\n<input type=\"text\" ng-model=\"config.set_community.value\" class=\"form-control\" placeholder=\"{{'Community'|translate}}\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'System Name'|translate}}\">\n<input type=\"text\" ng-model=\"config.sysName.value\" class=\"form-control\" placeholder=\"{{'Name'|translate}}\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'System Location'|translate}}\">\n<input type=\"text\" ng-model=\"config.sysLocation.value\" class=\"form-control\" placeholder=\"{{'Location'|translate}}\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'System Contact'|translate}}\">\n<input type=\"text\" ng-model=\"config.contact.value\" class=\"form-control\" placeholder=\"{{'E-Mail'|translate}}\"/>\n</juci-config-line>\n<juci-config-line title=\"{{'Trap Manager IP'|translate}}\">\n<juci-input-ipv4-address ng-model=\"config.manager_ip.value\"></juci-input-ipv4-address>\n</juci-config-line>\n</juci-config-lines>\n</juci-config-section>\n</div>\n</div>\n</juci-layout-with-sidebar>\n");