/**
 * Created by Kashan on 4/8/2017.
 */

const apiHost = '';

var storeId = 1; //change to 1 when done
var allOrders = [];
var currLat = 37.352435;
var currLong = -121.994070;
var storeLat = 37.352435;
var storeLong = -121.994070;
var done;
var updateLocation;
var orderStatusUpdate;

function santaClaraTruck()
{

    var currOrder;
    done = function doneWithOrder(orders)
    {
        var orderComplete = orders.pop();
        orderStatusUpdate('DELIVERED', orderComplete);
        scp(orders);
    };

    updateLocation = function (location) {

        console.log("UpdateLocation: " + location);
        var tnum = currOrder.TNUM;
        currLat = location.lat();
        currLong = location.lng();

        xhr = new XMLHttpRequest();
        var url = apiHost + "/group_one/shop/track/" + tnum;
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                //var json = JSON.parse(xhr.responseText);
                console.log("Update Coords: " + xhr.responseText);
            }
        };
        var data = JSON.stringify({"tlong": currLong, "tlat": currLat});
        xhr.send(data);
    };
    var scp = function santaClaraTruckProcess(orders) {


        allOrders = orders;
       if(orders.length > 0) {
           index = orders.length - 1;
           currOrder = orders[index];
           var trackNum = orders[index].TNUM;
           trackOrder(trackNum, orders, done);

       }
       else
       {
           /*
           currLat = storeLat;
           currLong = storeLong;
           console.log("No more orders, going to sleep for 60 seconds!");
           setTimeout(santaClaraTruck, 60000);*/
       }


    };




    console.log("Check orders");
    getOrderedOrders(scp);

    function getOrderedOrders(callback)
    {
        xhr = new XMLHttpRequest();
        var url = apiHost + "/group_one/shop/order";

        xhr.open("GET", url, true);
        xhr.setRequestHeader("Content-type", "application/json");
        xhr.setRequestHeader("storeid", storeId);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                try {
                    var jsonArray = JSON.parse(xhr.responseText);
                    console.log(xhr.responseText);

                    callback(jsonArray);
                }
                catch (err)
                {

                }
            }

        };
        xhr.send();
    }

    orderStatusUpdate = function updateOrderStatus(status, order)
    {
        var ONUM = order.ONUM;
        xhr = new XMLHttpRequest();
        var url = apiHost + "/group_one/shop/order/"+ONUM+"/status";
        console.log(ONUM);
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
}


function trackOrder(trackNum, orders, callback)
{
    //var trackNum = document.getElementById("input_track_number").value;

    xhr = new XMLHttpRequest();
    var url = apiHost + "/group_one/shop/track/" + trackNum;

    xhr.open("GET", url, true);
    xhr.setRequestHeader("Content-type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4 && xhr.status == 200) {
            try {
                var jsonArray = JSON.parse(xhr.responseText);

                var address = jsonArray[0].SNUM + " " + jsonArray[0].SNAME + " " + jsonArray[0].CITY + " " + jsonArray[0].STATE;
                var current = currLat + " " + currLong;

                console.log(xhr.responseText);
                console.log("address: " + address + " current: " + current);
                orderStatusUpdate('TRANSIT', orders[orders.length - 1]);
                calcRoute(address, current, orders, callback);
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

var map;
var directionDisplay;
var directionsService;
var stepDisplay;
var markerArray = [];
var position;
var marker = null;
var polyline = null;
var poly2 = null;
var speed = 0.000005, wait = 1;
var infowindow = null;

var myPano;
var panoClient;
var nextPanoId;
var timerHandle = null;

function createMarker(latlng, label, html) {
// alert("createMarker("+latlng+","+label+","+html+","+color+")");
    var contentString = '<b>'+label+'</b><br>'+html;
    var marker = new google.maps.Marker({
        position: latlng,
        map: map,
        title: label,
        zIndex: Math.round(latlng.lat()*-100000)<<5
    });
    marker.myname = label;
    // gmarkers.push(marker);

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
    // Instantiate a directions service.
    directionsService = new google.maps.DirectionsService();

    // Create a map and center it on Manhattan.
    var myOptions = {
        //zoom: 11,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

    address = 'Sunnyvale';
    geocoder = new google.maps.Geocoder();
    geocoder.geocode( { 'address': address}, function(results, status) {
        map.setCenter(results[0].geometry.location);
    });

    // Create a renderer for directions and bind it to the map.
    var rendererOptions = {
        map: map
    };
    directionsDisplay = new google.maps.DirectionsRenderer(rendererOptions);

    // Instantiate an info window to hold step text.
    stepDisplay = new google.maps.InfoWindow();

    polyline = new google.maps.Polyline({
        path: [],
        strokeColor: '#FF0000',
        strokeWeight: 3
    });
    poly2 = new google.maps.Polyline({
        path: [],
        strokeColor: '#FF0000',
        strokeWeight: 3
    });
}



var steps = []

function calcRoute(address, current, orders, callback){

    if (timerHandle) { clearTimeout(timerHandle); }
    if (marker) { marker.setMap(null);}
    polyline.setMap(null);
    poly2.setMap(null);
    directionsDisplay.setMap(null);
    polyline = new google.maps.Polyline({
        path: [],
        strokeColor: '#FF0000',
        strokeWeight: 3
    });
    poly2 = new google.maps.Polyline({
        path: [],
        strokeColor: '#FF0000',
        strokeWeight: 3
    });
    // Create a renderer for directions and bind it to the map.
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

    // Route the directions and pass the response to a
    // function to create markers for each step.
    directionsService.route(request, function(response, status) {
        if (status == google.maps.DirectionsStatus.OK){
            directionsDisplay.setDirections(response);

            var bounds = new google.maps.LatLngBounds();
            var route = response.routes[0];
            startLocation = new Object();
            endLocation = new Object();

            // For each route, display summary information.
            var path = response.routes[0].overview_path;
            var legs = response.routes[0].legs;
            for (i=0;i<legs.length;i++) {
                if (i == 0) {
                    startLocation.latlng = legs[i].start_location;
                    startLocation.address = legs[i].start_address;
                    // marker = google.maps.Marker({map:map,position: startLocation.latlng});
                    marker = createMarker(legs[i].start_location,"start",legs[i].start_address,"green");
                }
                endLocation.latlng = legs[i].end_location;
                endLocation.address = legs[i].end_address;
                var steps = legs[i].steps;
                for (j=0;j<steps.length;j++) {
                    var nextSegment = steps[j].path;
                    for (k=0;k<nextSegment.length;k++) {
                        polyline.getPath().push(nextSegment[k]);
                        bounds.extend(nextSegment[k]);



                    }
                }
            }

            polyline.setMap(map);
            //map.fitBounds(bounds);
//        createMarker(endLocation.latlng,"end",endLocation.address,"red");
            //map.setZoom(18);
            startAnimation(orders, callback);
        }
    });
}



var step = 200; // 5; // metres
var tick = 5000; // milliseconds
var eol;
var k=0;
var stepnum=0;
var speed = "";
var lastVertex = 1;


//=============== animation functions ======================
function updatePoly(d) {
    // Spawn a new polyline every 20 vertices, because updating a 100-vertex poly is too slow
    if (poly2.getPath().getLength() > 20) {
        poly2=new google.maps.Polyline([polyline.getPath().getAt(lastVertex-1)]);
        // map.addOverlay(poly2)
    }

    if (polyline.GetIndexAtDistance(d) < lastVertex+2) {
        if (poly2.getPath().getLength()>1) {
            poly2.getPath().removeAt(poly2.getPath().getLength()-1)
        }
        poly2.getPath().insertAt(poly2.getPath().getLength(),polyline.GetPointAtDistance(d));
    } else {
        poly2.getPath().insertAt(poly2.getPath().getLength(),endLocation.latlng);
    }
}


function animate(d) {
// alert("animate("+d+")");
    if (d>eol) {
        //map.panTo(endLocation.latlng);
        marker.setPosition(endLocation.latlng);
        done(allOrders);
        return;
    }
    var p = polyline.GetPointAtDistance(d);
    //map.panTo(p);
    marker.setPosition(p);
    updatePoly(d);
    d = d + step;
    updateLocation(p);
    //console.log(p.lat() + " " + p.lng());
    timerHandle = setTimeout("animate("+d+")", tick);

}




function startAnimation(orders, callback) {
    eol=polyline.Distance();
    map.setCenter(polyline.getPath().getAt(0));
    // map.addOverlay(new google.maps.Marker(polyline.getAt(0),G_START_ICON));
    // map.addOverlay(new GMarker(polyline.getVertex(polyline.getVertexCount()-1),G_END_ICON));
    // marker = new google.maps.Marker({location:polyline.getPath().getAt(0)} /* ,{icon:car} */);
    // map.addOverlay(marker);
    poly2 = new google.maps.Polyline({path: [polyline.getPath().getAt(0)], strokeColor:"#0000FF", strokeWeight:10});
    // map.addOverlay(poly2);
    setTimeout(animate(50),2000);  // Allow time for the initial map display
}


//=============== ~animation funcitons =====================


