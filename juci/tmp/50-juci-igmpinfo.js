
/*	
	This file is part of JUCI (https://github.com/mkschreder/juci.git)

	Copyright (c) 2015 Reidar Cederqvist <reidar.cederqvist@gmail.com>

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
.controller("StatusTVPageCtrl", function($scope, $rpc, gettext){
	if($rpc.juci.iptv){
		$rpc.juci.iptv.igmptable().done(function(result){
			if(!result.table) {
				$scope.$emit("error", gettext("Unable to retreive igmptable from device!")); 
				return; 
			} 
			$scope.igmptable = result.table; 
			$scope.$apply(); 
		}); 
	}
}); 

angular.module('gettext').run(['gettextCatalog', function (gettextCatalog) {
	gettextCatalog.setStrings('en', {"Unable to retreive igmptable from device!":"","IGPM TV Status":"IGPM TV Status","status.tv.info":"This page allows to verify the connection status of your IPTV Services.","Connection Status":"","IGMP TV Channels":"","Group IP":"","Client IP":"","LAN Port":"LAN Port","WAN Port":"","Timeout":"","status-tv-title":"IGMP Status","menu-status-tv-title":"IGMP Status"});
	gettextCatalog.setStrings('fi', {"Unable to retreive igmptable from device!":"Ei voitu hakea igmptaulua laitteesta!","IGPM TV Status":"IPTV Tila","status.tv.info":"Tällä sivulla voit tarkistaa IPTV-palvelun tilan.","Connection Status":"Yhteyden tila","IGMP TV Channels":"IGMP-TV-kanavat","Group IP":"Ryhmä IP","Client IP":"Asiakas IP","LAN Port":"LAN  portti","WAN Port":"WAN portti","Timeout":"Aikakatkaisu","status-tv-title":"IPTV Tila","menu-status-tv-title":"IPTV"});
	gettextCatalog.setStrings('sv-SE', {"Unable to retreive igmptable from device!":"Kan inte hämta IGMP-tabell från enheten!","IGPM TV Status":"TV-status","status.tv.info":"Information och status för IGMP snooping. ","Connection Status":"Uppkopplingsstatus","IGMP TV Channels":"IGMP TV Kanaler","Group IP":"Grupp-IP","Client IP":"Klient-IP","LAN Port":"Lan-port","WAN Port":"WAN-port","Timeout":"Timeout","status-tv-title":"TV","menu-status-tv-title":"TV"});
}]);

