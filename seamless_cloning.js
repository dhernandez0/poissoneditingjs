window.onload = function(e) {
	// Load size from "range" element
	changeSize();
	// Load mix_gradient from the checkbox
	mix_gradient = document.getElementById('mix_grad').checked;

	// Set event handlers
	document.getElementById('size').addEventListener('change', changeSize, false);
	window.addEventListener('keypress', modifyScale, false);
	document.getElementById('source_file').addEventListener('change', function(evt) {
		loadImgEvt(evt, document.getElementById('source'));
		orig_pixels = null;
		resetMask();
	}, false);
	document.getElementById('destination_file').addEventListener('change', function(evt) {
		loadImgEvt(evt, document.getElementById('destination'));
		orig_dest = null;
	}, false);
	document.getElementById('mix_grad').addEventListener('change', function() {
		mix_gradient = document.getElementById('mix_grad').checked;
	}, false);
	document.getElementById('run').addEventListener('click', function() {
		var start = new Date().getTime();
		var mask_pixels = mask.getContext('2d').getImageData(0, 0, mask.width, mask.height);
		var ctx = document.getElementById('result').getContext('2d');
		
		// Scale image, mask and coordinates of the surrounding rectangle
		var tmp_pixels = scaleImage(orig_pixels, scale);
		var tmp_mask = scaleImage(mask_pixels, scale);
		var tmp_first_x = Math.round(first_x*scale);
		var tmp_first_y = Math.round(first_y*scale);
		var tmp_last_x = Math.round(last_x*scale);
		var tmp_last_y = Math.round(last_y*scale);

		// Start a new thread
		var myWorker = new Worker("poisson_editing.js");

		// When it's finished draw the result
		myWorker.addEventListener("message", function (evt) {
			ctx.putImageData(evt.data, 0, 0);
			var end = new Date().getTime();
			var time = end - start;
			document.getElementById('time').value = time + ' ms';
			document.getElementById('run').disabled = false;
		}, false);

		var params = new Object();
		params.g = tmp_pixels;
		params.f_star = orig_dest;
		params.mask = tmp_mask;
		params.dest_x = pos_x;
		params.dest_y = pos_y;
		params.first_x = tmp_first_x;
		params.first_y = tmp_first_y;
		params.last_x = tmp_last_x;
		params.last_y = tmp_last_y;
		params.mix_gradient = mix_gradient;
		params.dest = ctx.createImageData(size, size);
		params.omega = 1.9;
		params.tol = 0.0001;
		params.max_iter = 100000;

		myWorker.postMessage(params); // start the worker.
		document.getElementById('run').disabled = true;
/*
***UNCOMMENT IF YOU DON'T WANT TO USE A WORKER***
		var params = new Object();
		params.g = tmp_pixels;
		params.f_star = orig_dest;
		params.mask = tmp_mask;
		params.dest_x = pos_x;
		params.dest_y = pos_y;
		params.first_x = tmp_first_x;
		params.first_y = tmp_first_y;
		params.last_x = tmp_last_x;
		params.last_y = tmp_last_y;
		params.mix_gradient = mix_gradient;
		params.dest = ctx.createImageData(size, size);
		params.omega = 1.9;
		params.tol = 0.0001;
		params.max_iter = 100000;
		var res = poisson_editing(params);
		ctx.putImageData(res, 0, 0);
		var end = new Date().getTime();
		var time = end - start;
		document.getElementById('time').value = time + ' ms';
		document.getElementById('run').disabled = false;
*/
	}, false);
	// When the user clicks on the source image, start drawing the mask
	document.getElementById('source').addEventListener("mousedown", function(evt) {
		var x = evt.pageX;
		var y = evt.pageY;
		var canvas = document.getElementById('source');
		x -= canvas.offsetLeft;
		y -= canvas.offsetTop;
		drawing = true;
		old_point_x = x;
		old_point_y = y;
		if(orig_pixels == null) {
			orig_pixels = document.getElementById('source').getContext('2d').getImageData(0, 0, mask.width, mask.height);
		}
		// Fake a user move to draw for the first time
		mouse_move(evt);
	}, false);
	// Finished drawing the mask
	document.getElementById('source').addEventListener("mouseup", function(evt) {
		drawing = false;
	}, false);
	document.getElementById('source').addEventListener("mousemove", mouse_move, false);
	document.getElementById('destination').addEventListener("mouseup", destClick, false);
}
mix_gradient = false;
orig_pixels = null;
orig_dest = null;
drawing = false;
old_point_x = 0;
old_point_y = 0;
first_x = 0;
first_y = 0;
last_x = 0;
last_y = 0;
pos_x = 0;
pos_y = 0;
size = 200;
scale = 1;
// Function called when the user moves the mouse
function mouse_move(evt) {
	// If we're drawing (click happened) draw
	if(drawing) {
		// Get the position of the pointer
		var x = evt.pageX;
		var y = evt.pageY;
		var canvas = document.getElementById('source');
		x -= canvas.offsetLeft;
		y -= canvas.offsetTop;
		ctx = canvas.getContext("2d");

		// Draw in the source
		ctx.strokeStyle = "rgba(0,255,0,1.0)";
		ctx.lineWidth = 20;
		ctx.lineJoin = "round";
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(old_point_x, old_point_y);
		ctx.lineTo(x, y);
		ctx.stroke();
		ctx.closePath();

		// Draw in the mask
		mask_ctx = mask.getContext("2d");
		mask_ctx.strokeStyle = "rgba(255,255,255,1.0)";
		mask_ctx.lineWidth = 20;
		mask_ctx.lineJoin = "round";
		mask_ctx.lineCap = "round";
		mask_ctx.beginPath();
		mask_ctx.moveTo(old_point_x, old_point_y);
		mask_ctx.lineTo(x, y);
		mask_ctx.stroke();
		mask_ctx.closePath();

		// Save last position
		old_point_x = x;
		old_point_y = y;
	}
}
// Load image and draw it
function loadImgEvt(evt, canvas) {
	var f = evt.target.files[0];

	// Create image
	var img = document.createElement("img");

	// Read image
	var reader = new FileReader();
	reader.onload = (function(aImg, canvas) { return function(e) {
		aImg.src = e.target.result;
		aImg.onload = (function(aImg, canvas) { return function(e) {
			var h = aImg.height;
			var w = aImg.width;
			
			// Resize the image
			if(h > w) {
				h = size;
				w = Math.round(size*w/aImg.height);
			} else {
				w = size;
				h = Math.round(size*h/aImg.width);
			}	
			canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);	
			canvas.getContext("2d").drawImage(aImg, 0, 0, w, h);
		};})(aImg, canvas);
	};})(img, canvas);
	reader.readAsDataURL(f);
}
// Reset mask
function resetMask() {
	mask = document.createElement('canvas');
	// Resize mask
	mask.width  = size;
	mask.height = size;
	// Generate empty mask
	var mask_pixels = mask.getContext('2d').getImageData(0, 0, mask.width, mask.height);
	for(var i=0; i<mask_pixels.data.length; i++) {
		mask_pixels.data[i] = 0;
	}
	mask.getContext('2d').putImageData(mask_pixels, 0, 0);
}
// Scale image by a factor
function scaleImage(img, factor) {
	// Create a canvas with the source image
	var tmp = document.createElement('canvas');
	var ctx = tmp.getContext('2d');
	tmp.width = size;
	tmp.height = size;
	ctx.putImageData(img, 0, 0);

	// Create a second canvas with the new size
	var tmp2 = document.createElement('canvas');
	var ctx2 = tmp2.getContext('2d');
	tmp2.width = Math.round(size*factor);
	tmp2.height = Math.round(size*factor);
	// Draw the previous canvas in the new one resized
	ctx2.drawImage(tmp, 0, 0, Math.round(size*factor), Math.round(size*factor));
	return ctx2.getImageData(0, 0, tmp2.width, tmp2.height, 0, 0, tmp.width, tmp.height);
}
// Modify scale with '+' and '-' keys
function modifyScale(event) {
	var key = event.keyCode || event.which;
	var keychar = String.fromCharCode(key);
	if (keychar == '+') {
		scale += 0.05;
	} else if(keychar == '-') {
		scale -= 0.05;
	}
	// Generate a fake event in order to draw the preview again
	evt = new Object();
	var canvas = document.getElementById('destination');
	evt.pageX = pos_x + canvas.offsetLeft;
	evt.pageY = pos_y + canvas.offsetTop;
	destClick(evt);
}
// Function called when someone clicks on the destination image
function destClick(evt) {
	var canvas = document.getElementById('destination');
	var mask_pixels = mask.getContext('2d').getImageData(0, 0, mask.width, mask.height);
	var dest_pixels = canvas.getContext('2d').getImageData(0, 0, mask.width, mask.height);
	// If it's the first time, get image data, we need the original (not modified) version
	if(orig_dest == null) {
		orig_dest = canvas.getContext('2d').getImageData(0, 0, mask.width, mask.height);
	}
	first_x = Number.MAX_VALUE;
	first_y = Number.MAX_VALUE;
	last_x = 0;
	last_y = 0;
	// Get first x,y and last x,y to have the surrounding rectangle of the regions to copy
	for(var i=0; i<mask.height; i++) {
		for(var j=0; j<mask.width; j++) {
			for(var rgb=0; rgb<3; rgb++) {
				var k = (i*mask.width+j)*4+rgb;
				if(mask_pixels.data[k] == 255) {
					first_x = Math.min(j, first_x);
					first_y = Math.min(i, first_y);
					last_x = Math.max(j, last_x);
					last_y = Math.max(i, last_y);
				}
				dest_pixels.data[k] = orig_dest.data[k];
			}
		}
	}

	// Get the position the user clicked on
	pos_x = evt.pageX;
	pos_y = evt.pageY;
	pos_x -= canvas.offsetLeft;
	pos_y -= canvas.offsetTop;

	// Scale the source image and mask
	var tmp_pixels = scaleImage(orig_pixels, scale);
	var tmp_mask = scaleImage(mask_pixels, scale);
	// Scale the parameters
	var tmp_first_x = Math.round(first_x*scale);
	var tmp_first_y = Math.round(first_y*scale);
	var tmp_last_x = Math.round(last_x*scale);
	var tmp_last_y = Math.round(last_y*scale);

	var endX=tmp_last_x-tmp_first_x;
	var endY=tmp_last_y-tmp_first_y;

	// Print a preview of the regions to copy into the destination canvas
	for(var i=0; i<endY; i++) {
		for(var j=0; j<endX; j++) {
			for(var rgb=0; rgb<3; rgb++) {
				var k = ((i+tmp_first_y)*tmp_mask.width+j+tmp_first_x)*4+rgb;
				var l = ((i+pos_y)*dest_pixels.width+j+pos_x)*4+rgb;
				if(tmp_mask.data[k] == 255) {
					dest_pixels.data[l] = tmp_pixels.data[k];
				}
			}
		}
	}
	canvas.getContext('2d').putImageData(dest_pixels, 0, 0);
}
// This function resizes all canvas with the value of the "range" input and recreates the mask too
function changeSize() {
	size = document.getElementById('size').value;

	document.getElementById('result').width = size;
	document.getElementById('result').height = size;

	document.getElementById('source').width = size;
	document.getElementById('source').height = size;

	document.getElementById('destination').width = size;
	document.getElementById('destination').height = size;

	resetMask();
}
