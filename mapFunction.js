/**
 * Created by Kashan on 4/8/2017.
 */

const apiHost = '';

let santaClaraStart = false;
let sanMateoStart = false;

function santaClaraTruck()
{
    const storeId = 1;
    const truckInfo = {"storeId" : storeId, "currLat" : 37.352435, "currLong" : -121.994070, "allOrders" : [], "storeLat" : 37.352435, "storeLong" :  -121.994070, "start" : function () { return santaClaraStart}, "marker" : null, "polyline": new google.maps.Polyline({
        path: [],
        strokeColor: '#FF0000',
        strokeWeight: 3
    }), "poly2" : new google.maps.Polyline({
        path: [],
        strokeColor: '#44ff2b',
        strokeWeight: 3
    })};

    if(!santaClaraStart) {
        santaClaraStart = true;
        console.log("Check orders");
        getOrderedOrders(truckInfo);
    }
    else
        santaClaraStart = false;




}

function sanMateoTruck()
{
    const storeId = 2;
    const truckInfo = {"storeId" : storeId, "currLat" : 37.563564, "currLong" : -122.323272, "allOrders" : [], "storeLat" : 37.352435, "storeLong" :  -121.994070, "start" : function () { return sanMateoStart}, "marker" : null, "polyline": new google.maps.Polyline({
        path: [],
        strokeColor: '#FF0000',
        strokeWeight: 3
    }), "poly2" : new google.maps.Polyline({
        path: [],
        strokeColor: '#6180ff',
        strokeWeight: 3
    })};

    if(!sanMateoStart) {
        sanMateoStart = true;
        console.log("Check orders");
        getOrderedOrders(truckInfo);
    }
    else
        sanMateoStart = false;




}

function getOrderedOrders(truckInfo)
{
    console.log("storeid: " + truckInfo.storeId);
    xhr = new XMLHttpRequest();
    const url = apiHost + "/group_one/shop/order";

    xhr.open("GET", url, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.setRequestHeader("storeid", truckInfo.storeId);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            try {
                const jsonArray = JSON.parse(xhr.responseText);
                console.log(xhr.responseText);

                truckProcess(truckInfo, jsonArray);
            }
            catch (err)
            {
                console.log(err);
            }
        }

    };
    xhr.send();
}

function truckProcess(truckInfo, orders) {


    truckInfo.allOrders = orders;
    if(orders.length > 0 && truckInfo.start() )  {
        index = orders.length - 1;
        currOrder = orders[index];
        trackOrder(orders[index].TNUM, truckInfo);

    }
    else
    {

         truckInfo.currLat = truckInfo.storeLat;
         truckInfo.currLong = truckInfo.storeLong;
         console.log("No more orders, going to sleep for 60 seconds!");
         if(truckInfo.storeId == 1) {
             santaClaraStart = false;
             setTimeout(santaClaraTruck, 60000);
         }
         else {
             sanMateoStart = false;
             setTimeout(sanMateoTruck, 60000);
         }
    }


};

function trackOrder(trackNum, truckInfo)
{

    xhr = new XMLHttpRequest();
    const url = apiHost + "/group_one/shop/track/" + trackNum;

    xhr.open("GET", url, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            try {
                const jsonArray = JSON.parse(xhr.responseText);

                const address = jsonArray[0].SNUM + " " + jsonArray[0].SNAME + " " + jsonArray[0].CITY + " " + jsonArray[0].STATE;
                const current = truckInfo.currLat + " " + truckInfo.currLong;

                console.log(xhr.responseText);
                console.log("address: " + address + " current: " + current);
                updateOrderStatus('TRANSIT', truckInfo.allOrders[truckInfo.allOrders.length - 1].ONUM);
                calcRoute(address, current, truckInfo);
            }
            catch (err)
            {
                console.log(err);
                window.alert(trackNum + ' was not found');
            }
        }
    };
    xhr.send();
}

function updateOrderStatus(status, onum)
{
    xhr = new XMLHttpRequest();
    const url = apiHost + "/group_one/shop/order/"+onum+"/status";
    console.log("Order number: " + onum);

    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {

            console.log(xhr.responseText);
        }
    };
    var data = JSON.stringify({"stat": status});
    xhr.send(data);
};

function doneWithOrder(truckInfo)
{
    let orders = truckInfo.allOrders;
    updateOrderStatus('DELIVERED', orders.pop().ONUM);
    truckInfo.allOrders = orders;
    truckProcess(truckInfo, orders);
};


function updateLocation (location, truckInfo) {

    console.log("UpdateLocation: " + location);
    const tnum = truckInfo.allOrders[truckInfo.allOrders.length - 1].TNUM;//currOrder.TNUM;
    truckInfo.currLat = location.lat();
    truckInfo.currLong = location.lng();

    xhr = new XMLHttpRequest();
    var url = apiHost + "/group_one/shop/track/" + tnum;
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {

            console.log("Update Coords: " + xhr.responseText);
        }
    };
    var data = JSON.stringify({"tlong": truckInfo.currLong, "tlat": truckInfo.currLat});
    xhr.send(data);
};

var map;
var directionsService;
var stepDisplay;
var infowindow = null;


function createMarker(latlng, label, html) {

    var contentString = '<b>'+label+'</b><br>'+html;
    var marker = new google.maps.Marker({
        position: latlng,
        map: map,
        title: label,
        zIndex: Math.round(latlng.lat()*-100000)<<5
    });
    marker.myname = label;

    google.maps.event.addListener(marker, 'click', function() {
        infowindow.setContent(contentString);
        infowindow.open(map,marker);
    });
    return marker;
}




function initialize() {
    infowindow = new google.maps.InfoWindow(
        {
            size: new google.maps.Size(150,50)
        });

    directionsService = new google.maps.DirectionsService();


    var myOptions = {

        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    address = 'Sunnyvale';
    geocoder = new google.maps.Geocoder();
    geocoder.geocode( { 'address': address}, function(results, status) {
        map.setCenter(results[0].geometry.location);
    });


    var rendererOptions = {
        map: map
    };
    directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);


    stepDisplay = new google.maps.InfoWindow();

}


function calcRoute(address, current, truckInfo){

    if (truckInfo.marker) { truckInfo.marker.setMap(null);}
    truckInfo.polyline.setMap(null);
    truckInfo.poly2.setMap(null);
    directionsDisplay.setMap(null);
    truckInfo.polyline = new google.maps.Polyline({
        path: [],
        strokeColor: '#FF0000',
        strokeWeight: 3
    });
    truckInfo.poly2 = new google.maps.Polyline({
        path: [],
        strokeColor: '#FF0000',
        strokeWeight: 3
    });


    var rendererOptions = {
        map: map
    };
    directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);

    var start = current;
    var end = address;
    var travelMode = google.maps.DirectionsTravelMode.DRIVING

    var request = {
        origin: start,
        destination: end,
        travelMode: travelMode
    };


    directionsService.route(request, function(response, status) {
        if (status == google.maps.DirectionsStatus.OK){
            directionsDisplay.setDirections(response);

            var bounds = new google.maps.LatLngBounds();
            var route = response.routes[0];
            startLocation = new Object();
            endLocation = new Object();


            var path = response.routes[0].overview_path;
            var legs = response.routes[0].legs;
            for (i=0;i<legs.length;i++) {
                if (i == 0) {
                    startLocation.latlng = legs[i].start_location;
                    startLocation.address = legs[i].start_address;

                    truckInfo.marker = createMarker(legs[i].start_location,"start",legs[i].start_address,"green");
                }
                endLocation.latlng = legs[i].end_location;
                endLocation.address = legs[i].end_address;
                var steps = legs[i].steps;
                for (j=0;j<steps.length;j++) {
                    var nextSegment = steps[j].path;
                    for (k=0;k<nextSegment.length;k++) {
                        truckInfo.polyline.getPath().push(nextSegment[k]);
                        bounds.extend(nextSegment[k]);



                    }
                }
            }

            truckInfo.polyline.setMap(map);

            startAnimation(truckInfo);
        }
    });
}



var step = 200;
var tick = 5000; // milliseconds
var k=0;
var lastVertex = 1;



function updatePoly(d, truckInfo) {

    if (truckInfo.poly2.getPath().getLength() > 20) {
        truckInfo.poly2=new google.maps.Polyline([truckInfo.polyline.getPath().getAt(lastVertex-1)]);

    }

    if (truckInfo.polyline.GetIndexAtDistance(d) < lastVertex+2) {
        if (truckInfo.poly2.getPath().getLength()>1) {
            truckInfo.poly2.getPath().removeAt(truckInfo.poly2.getPath().getLength()-1)
        }
        truckInfo.poly2.getPath().insertAt(truckInfo.poly2.getPath().getLength(),truckInfo.polyline.GetPointAtDistance(d));
    } else {
        truckInfo.poly2.getPath().insertAt(truckInfo.poly2.getPath().getLength(),endLocation.latlng);
    }
}


function animate(d, truckInfo) {

    if (d>truckInfo.polyline.Distance()) {

        truckInfo.marker.setPosition(endLocation.latlng);
        doneWithOrder(truckInfo);
        return;
    }
    var p = truckInfo.polyline.GetPointAtDistance(d);

    truckInfo.marker.setPosition(p);
    if(!truckInfo.start()) {
        truckInfo.marker.setMap(null);
        truckInfo.polyline.setMap(null);
        truckInfo.poly2.setMap(null);
        return;
    }
    updatePoly(d, truckInfo);
    d = d + step;
    updateLocation(p, truckInfo);

    setTimeout(function () { animate(d,truckInfo); }, tick);

}




function startAnimation(truckInfo) {
    map.setCenter(truckInfo.polyline.getPath().getAt(0));
    truckInfo.poly2 = new google.maps.Polyline({path: [truckInfo.polyline.getPath().getAt(0)], strokeColor:"#0000FF", strokeWeight:10});
    setTimeout(function() { animate(50, truckInfo); },2000);  // Allow time for the initial map display
}



