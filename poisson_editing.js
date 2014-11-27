// Receive message from main thread
onmessage = function (evt) {
	var res = poisson_editing(evt.data);
	// Return result to main thread
	postMessage(res);
}
/**
Executes the poisson editing algorithm http://www.cs.jhu.edu/~misha/Fall07/Papers/Perez03.pdf
Parameters:
g = Source image
f_star = Destination image
mask = Mask of the original, what we want to copy
dest_x, dest_y = Position on the destination image where we'll copy
first_x, first_y, last_x, last_y = Coordinates of the rectangle where we have someting to copy
mix_gradient = Whether we have to use mix gradient
dest = Destination ImageData (use canvas.getContext('2d').createImageData(...)
omega = omega relaxtion (this is implemeted with Gauss Seidel)
tol = Tolerance we'll use to stop
max_iter = Maximum number of iterations
*/
function poisson_editing(param) {
	// Use local variables
	var g = param.g;
	var f_star = param.f_star;
	var mask = param.mask;
	var dest_x = param.dest_x;
	var dest_y = param.dest_y;
	var first_x = param.first_x;
	var first_y = param.first_y;
	var last_x = param.last_x;
	var last_y = param.last_y;
	var mix_gradient = param.mix_gradient;
	var dest = param.dest;
	var omega = param.omega;
	var tol = param.tol;
	var max_iter = param.max_iter;

	// Calculate the number of pixels
	var endX = last_x-first_x+1;
	var endY = last_y-first_y+1;

	// Number of iterations
	var it = 0;

	// Maximum difference
	var diff = Number.MAX_VALUE;

	// Copy destination image ROI
	// We need 2 pixels because of the boundary conditions
	var f = new Array((endY+2)*(endX+2)*4);
	for(var i=0; i<endY+2; i++) {
		for(var j=0; j<endX+2; j++) {
			for(var rgb=0; rgb<3; rgb++) {
				var k = ((i+dest_y-1)*f_star.width+j+dest_x-1)*4+rgb;
				var l = (i*(endX+2)+j)*4+rgb;
				f[l] = f_star.data[k];
			}
		}
	}

	// Compute gradient of g (if mix gradient, the strongest of g or f)
	// We need 2 pixels because of the boundary conditions
	var g_grad_x = new Array((endY+2)*(endX+2)*4);
	var g_grad_y = new Array((endY+2)*(endX+2)*4);
	for(var i=0; i<endY+2; i++) {
		for(var j=0; j<endX+2; j++) {
			var gi_cur = ((i+first_y-1)*g.width+j+first_x-1)*4;
			for(var rgb=0; rgb<3; rgb++) {
				var gi_right = gi_cur+4;
				var gi_down = gi_cur+g.width*4;

				var g_cur = g.data[gi_cur];
				var g_right = g.data[gi_right];
				var g_down = g.data[gi_down];
				// Gradient of g (x and y)
				var rmc = g_right-g_cur;
				var dmc = g_down-g_cur;
				g_grad_x[(i*endX+j)*4+rgb] = rmc;
				g_grad_y[(i*endX+j)*4+rgb] = dmc;

				// If mix gradient is enabled we have to keep the strongest gradient
				if(mix_gradient) {
					// We don't need to do sqrt, because we're comparing
					var mod_g = Math.pow(rmc, 2)+Math.pow(dmc, 2);

					var f_cur = f[(i*(endX+2)+j)*4+rgb];
					var f_right = f[(i*(endX+2)+j+1)*4+rgb];
					var f_down = f[((i+1)*(endX+2)+j)*4+rgb];
					// Same here, no sqrt
					rmc = f_right-f_cur;
					dmc = f_down-f_cur;
					var mod_f = Math.pow(rmc, 2)+Math.pow(dmc, 2);

					// Compare the gradients, if f is stronger keep it otherwise keep g
					if(mod_f > mod_g) {
						g_grad_x[(i*endX+j)*4+rgb] = rmc;
						g_grad_y[(i*endX+j)*4+rgb] = dmc;
					}
				}
				gi_cur++;
			}
		}
	}
	// Compute the laplacian of the gradient of g (or combination if mix gradient)
	var g_laplace = new Array(endY*endX*4);
	for(var i=0; i<endY; i++) {
		for(var j=0; j<endX; j++) {
			var mask_cur = ((i+first_y)*g.width+j+first_x)*4;
			if(mask.data[mask_cur] == 255) {
				for(var rgb=0; rgb<3; rgb++) {
					var pi_cur = g_grad_y[((i+1)*endX+j+1)*4+rgb];
					var pi_prev = g_grad_y[(i*endX+j+1)*4+rgb];
					var pj_cur = g_grad_x[((i+1)*endX+j+1)*4+rgb];
					var pj_prev = g_grad_x[((i+1)*endX+j)*4+rgb];
					g_laplace[(i*endX+j)*4+rgb] = pi_cur - pi_prev + pj_cur - pj_prev;
					mask_cur++;
				}
			}
		}
	}

	// Iterate until reach convergence or reach maximum number of iterations
	while(it < max_iter && diff > tol) {
		diff = 0;
		for(var i=1; i<endY+1; i++) {
			for(var j=1; j<endX+1; j++) {
				var k = ((i+first_y-1)*g.width+j+first_x-1)*4;
				if(mask.data[k] == 255) {
					var fi_cur = (i*(endX+2)+j)*4;
					for(var rgb=0; rgb<3; rgb++) {
						var fi_left = fi_cur-4;
						var fi_right = fi_cur+4;
						var fi_up = fi_cur-(endX+2)*4;
						var fi_down = fi_cur+(endX+2)*4;

						var f_cur = f[fi_cur];
						var f_left = f[fi_left];
						var f_right = f[fi_right];
						var f_up = f[fi_up];
						var f_down = f[fi_down];

						// equation div(g) - div(f) = 0
						f[fi_cur] = (1-omega)*f_cur + omega*(f_up + f_left + f_down + f_right - g_laplace[((i-1)*endX+j-1)*4+rgb])/4;
						// Get the maximum difference
						diff = Math.max(diff, Math.abs(f[fi_cur]-f_cur));
						fi_cur++;
					}
				}
			}
		}
		it++;
	}
	// Copy the f_star to dest
	for(var i=0; i<dest.data.length; i++) {
		dest.data[i] = f_star.data[i];
	}

	// Copy the ROI we've been working on to dest
	for(var i=1; i<endY+1; i++) {
		for(var j=1; j<endX+1; j++) {
			for(var rgb=0; rgb<3; rgb++) {
				var k = ((i+first_y-1)*g.width+j+first_x-1)*4+rgb;
				if(mask.data[k] == 255) {
					var p = f[(i*(endX+2)+j)*4+rgb];
					var dest_cur = (((i-1)+dest_y)*f_star.width+j+dest_x-1)*4+rgb;
					// If we have some pixel out of bounds do this:
					if(p < 0) { p = 0;} else if(p > 255) {p = 255;}
					dest.data[dest_cur] = p;
				}
			}
		}
	}

	return dest;
}
