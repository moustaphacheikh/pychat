var CONNECTION_RETRY_TIME = 5000;
var SYSTEM_HEADER_CLASS = 'message-header-system';
var TIME_SPAN_CLASS = 'timeMess';
var CONTENT_STYLE_CLASS = 'message-text-style';
var DEFAULT_CHANNEL_NAME = 1;
// used in ChannelsHandler and ChatHandler
var USER_ID_ATTR = 'userid';
var SELF_HEADER_CLASS = 'message-header-self';
var USER_NAME_ATTR = 'username';
var REMOVED_MESSAGE_CLASSNAME = 'removed-message';
var MESSAGE_ID_ATTRIBUTE = 'messageId';
var YOUTUBE_REGEX = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/;
var MAX_ACCEPT_FILE_SIZE_WO_FS_API = Math.pow(2, 28); // 256 MB
// end used
var SYSTEM_USERNAME = 'System';
var CANCEL_ICON_CLASS_NAME = 'icon-cancel-circled-outline';
var PASTED_IMG_CLASS = 'B4j2ContentEditableImg';
var GENDER_ICONS = {
	'Male': 'icon-man',
	'Female': 'icon-girl',
	'Secret': 'icon-user-secret'
};
var smileUnicodeRegex = /[\u3400-\u3500]/g;
var imageUnicodeRegex = /[\u3501-\u3600]/g;
var timePattern = /^\(\d\d:\d\d:\d\d\)\s\w+:.*&gt;&gt;&gt;\s/;
var mouseWheelEventName = (/Firefox/i.test(navigator.userAgent)) ? "DOMMouseScroll" : "mousewheel";
// browser tab notification
// input type that contains text for sending message
var userMessage;
// navbar label with current user name
var headerText;
// OOP variables
var notifier;
var webRtcApi;
var smileyUtil;
var channelsHandler;
var wsHandler;
var storage;
var singlePage;
var painter;
var minimizedWindows;

onDocLoad(function () {
	userMessage = $("usermsg");
	headerText = $('headerText');
	minimizedWindows = new MinimizedWindows();
	// some browser don't fire keypress event for num keys so keydown instead of keypress
	channelsHandler = new ChannelsHandler();
	singlePage = new PageHandler();
	webRtcApi = new WebRtcApi();
	smileyUtil = new SmileyUtil();
	wsHandler = new WsHandler();
	//bottom call loadMessagesFromLocalStorage(); s
	if (typeof finishInitSmile != 'undefined') {
		finishInitSmile();
	}
	storage = new Storage();
	notifier = new NotifierHandler();
	painter = new Painter();
	logger.info("Trying to resolve WebSocket Server")();
	wsHandler.listenWS();
	Utils.showHelp();
});


function MinimizedWindows() {
	var self = this;
	self.draggables = [];
	self.dom = {
		ul: document.createElement('UL'),
		minimizedWindowsIcon: $('minimizedWindows')
	};
	self.init = function () {
		self.dom.ul.className = 'minimizedList window list ' + CssUtils.visibilityClass;
		document.body.appendChild(self.dom.ul);
		self.dom.minimizedWindowsIcon.onclick = self.toggle;
		self.dom.ul.onclick = self.onulclick;
	};
	self.onulclick = function (e) {
		if (e.target.tagName === 'LI') {
			document.removeEventListener("click", self.hideWindow);
			var el = self.findAndRemove(e.target, true);
			el.show();
			self.hideIfNeeded();
			CssUtils.hideElement(self.dom.ul);
		}
	};
	self.toggle = function (e) {
		var wasVisible = CssUtils.toggleVisibility(self.dom.ul);
		if (!wasVisible) {
			document.addEventListener("click", self.hideWindow);
			var a = self.dom.minimizedWindowsIcon;
			e.stopPropagation();
			self.dom.ul.style.top = a.offsetHeight + a.offsetTop + 'px';
			self.dom.ul.style.left = a.offsetLeft - 100 + 'px';
		} else {
			document.removeEventListener("click", self.hideWindow);
		}
	};
	self.hideWindow = function () {
		document.removeEventListener("click", self.hideWindow);
		CssUtils.hideElement(self.dom.ul);
	};
	self.add = function (draggable) {
		var li = document.createElement('li');
		self.dom.ul.appendChild(li);
		li.textContent = draggable.getHeaderText();
		self.draggables.push({obj: draggable, li: li});
		draggable.hide();
		CssUtils.showElement(self.dom.minimizedWindowsIcon);
	};
	self.findAndRemove = function (li, isLi) {
		for (var i = 0; i < self.draggables.length; i++) {
			var e = self.draggables[i];
			if ((isLi && e.li === li) || (!isLi && e.obj === li)) {
				self.draggables.splice(i, 1);
				self.dom.ul.removeChild(e.li);
				return e.obj;
			}
		}
	};
	self.hideIfNeeded = function () {
		if (self.draggables.length === 0) {
			CssUtils.hideElement(self.dom.minimizedWindowsIcon);
		}
	};
	self.remove = function (draggable) {
		var e = self.findAndRemove(draggable);
		if (e) {
			e.hide();
			self.hideIfNeeded();
		} else {
			logger.error("Draggable {} not found", draggable)();
		}
	};
	self.init();
}


function Draggable(container, headerText) {
	var self = this;
	self.UNACTIVE_CLASS = 'blurred';
	self.MOVING_CLASS = 'moving';
	self.dom = {
		container: container,
		iconMinimize: document.createElement('I'),
		header: document.createElement('DIV'),
		iconCancel: document.createElement('i'),
	};
	self.headerText = headerText;
	self.preventDefault = function (e) {
		e.stopPropagation();
		e.preventDefault();
	};
	self.onMouseMove = function (e) {
		self.top = e.pageY;
		self.left = e.pageX;
	};
	self.init = function () {
		CssUtils.addClass(self.dom.container, "modal-body");
		self.dom.container.style.left = '10%';
		self.dom.container.style.top = '10%';
		self.dom.header.appendChild(self.dom.iconMinimize);
		self.dom.iconMinimize.onclick = self.minimize;
		self.dom.iconMinimize.className = 'icon-minimize';
		self.dom.iconMinimize.setAttribute('title', 'Minimize window');
		self.dom.header.className = 'windowHeader noSelection';
		self.zoom = 1;
		self.dom.header.addEventListener("mousedown", function (ev) {
			self.mouseDownElement = ev.target;
			self.dom.container.setAttribute('draggable', true);
		}, false);
		self.dom.container.ondragstart = self.ondragstart;
		self.dom.container.ondragend = self.ondragend;
		// self.dom.container.ondrop = self.preventDefault; // TODO doens't work
		// self.dom.container.ondragleave  = self.preventDefault; // this thing causes ondrop event on messages
		// self.dom.container.ondragenter  = self.preventDefault;
		self.dom.headerText = document.createElement('span');
		self.dom.header.appendChild(self.dom.headerText);
		self.setHeaderText(self.headerText);
		self.dom.header.appendChild(self.dom.iconCancel);
		self.dom.iconCancel.onclick = self.hide;
		self.dom.iconCancel.className = 'icon-cancel';
		self.dom.iconCancel.setAttribute('title', 'Close window');
		self.dom.body = self.dom.container.children[0];
		if (!self.dom.body) {
			self.dom.body = document.createElement('DIV');
			self.dom.container.appendChild(self.dom.body);
		}
		CssUtils.addClass(self.dom.body, 'window-body');
		self.dom.container.insertBefore(self.dom.header, self.dom.body);
		self.dom.container.addEventListener('focus', self.onfocus);
		self.dom.container.addEventListener('blur', self.onfocusout);
		self.dom.container.setAttribute('tabindex', "-1");
	};
	self.ondragend = function (e) {
		var x, y;
		if (isFirefox) {
			document.removeEventListener('dragover', self.onMouseMove);
			x = self.left;
			y = self.top;
		} else {
			x = e.pageX;
			y = e.pageY;
		}
		CssUtils.removeClass(self.dom.container, self.MOVING_CLASS);
		var left = x + self.leftCorrection;
		if (left < 0) {
			left = 0;
		} else if (left > self.maxLeft) {
			left = self.maxLeft;
		}
		var top = y + self.topCorrection;
		if (top < 0) {
			top = 0;
		} else if (top > self.maxTop) {
			top = self.maxTop;
		}
		self.dom.container.style.left = left + "px";
		self.dom.container.style.top = top + "px";
		self.dom.container.removeAttribute('draggable');
	};
	self.ondragstart = function (e) {
		if (isFirefox) {
			e.dataTransfer.setData('text/plain', 'won');
			document.addEventListener('dragover', self.onMouseMove);
		}
		var clickedEl = self.mouseDownElement;
		self.mouseDownElement = null;
		if (isDescendant(self.dom.header, clickedEl)) {
			if (clickedEl.tagName !== 'I') {
				CssUtils.addClass(self.dom.container, self.MOVING_CLASS);
				self.leftCorrection = self.dom.container.offsetLeft - e.pageX;
				self.topCorrection = self.dom.container.offsetTop - e.pageY;
				self.maxTop = document.body.clientHeight - self.dom.container.clientHeight - 7;
				self.maxLeft = document.body.clientWidth - self.dom.container.clientWidth - 3;
				return;
			}
		}
		e.preventDefault();
	};
	self.fixInputs = function () {
		if (!self.dom.container.id) {
			self.dom.container.id = 'draggable' + getRandomId();
		}
		var inputs = document.querySelectorAll('#{0} input, #{0} button'.formatPos(container.id));
		// typeOf(inputs) = HTMLCollection, not an array. that doesn't have forEach
		for (var i = 0; i < inputs.length; i++) {
			inputs[i].addEventListener('focus', function () {
				CssUtils.addClass(self.dom.container, self.UNACTIVE_CLASS);
			});
			inputs[i].addEventListener('blur', function () {
				CssUtils.removeClass(self.dom.container, self.UNACTIVE_CLASS);
			});
		}
	};
	self.hide = function () {
		CssUtils.hideElement(self.dom.container);
	};
	self.setHeaderText = function (text) {
		self.dom.headerText.innerHTML = text;
	};
	self.getHeaderText = function () {
		return self.dom.headerText.textContent;
	};
	self.show = function () {
		CssUtils.showElement(self.dom.container);
	};
	self.destroy = function () {
		CssUtils.deleteElement(self.dom.container);
	};
	self.minimize = function () {
		minimizedWindows.add(self);
	};
	self.super = {
		show: self.show,
		hide: self.hide
	};
	self.init();
}

function Painter() {
	var self = this;
	Draggable.call(self, $('canvasHolder'), "Painter");
	self.ZOOM_SCALE = 1.1;
	self.PICKED_TOOL_CLASS = 'active-icon';
	self.dom.canvas = $('painter');
	self.dom.painterIcon = $('painterIcon');
	self.dom.paintDimensions = $('paintDimensions');
	self.dom.canvasWrapper = $('canvasWrapper');
	self.instruments = {
		color: {
			holder: $('paintColor'),
			handler: 'onChangeColor',
			ctxSetter: function (v) {
				self.ctx.strokeStyle = v;
			},
		},
		apply: {
			holder: $('paintApplyText'),
			trigger: 'click',
			handler: 'onApply'
		},
		opacity: {
			holder: $('paintOpacity'),
			handler: 'onChangeOpacity',
			range: true,
			ctxSetter: function (v) {
				self.ctx.globalAlpha = v / 100;
			}
		},
		width: {
			range: true,
			holder: $('paintRadius'),
			handler: 'onChangeRadius',
			ctxSetter: function (v) {
				self.ctx.lineWidth = v;
			},
		},
		font: {
			holder: $('paintFont'),
			handler: 'onChangeFont',
			ctxSetter: function (v) {
				self.ctx.fontFamily = v;
			}
		}
	};
	self.ctx = self.dom.canvas.getContext('2d');
	self.init = {
		initInstruments: function () { // TODO this looks bad
			Object.keys(self.instruments).forEach(function (k) {
				var instr = self.instruments[k];
				instr.value = instr.holder.querySelector('.value')
				instr.value.addEventListener(instr.trigger || 'input', function (e) {
					if (instr.range && instr.value.value.length > 2 && this.value != 100) { // != isntead !== in case it's a string
						instr.value.value = this.value.slice(0, 2)
					}
					instr.ctxSetter && instr.ctxSetter(e.target.value);
					var handler = self.tools[self.mode][instr.handler];
					handler && handler(e);
					if (instr.range) {
						instr.range.value = instr.value.value;
						fixInputRangeStyle(instr.range);
					}
				});
				if (instr.range) {
					instr.value.addEventListener('keypress', function (e) {
						var charCode = e.which || e.keyCode;
						return charCode > 47 && charCode < 58;
					});
					instr.range = instr.holder.querySelector('input[type=range]');
					instr.range.addEventListener('input', function (e) {
						instr.value.value = instr.range.value;
						instr.ctxSetter(e.target.value);
						var handler = self.tools[self.mode][instr.handler];
						handler && handler(e);
					});
				}
			});
		},
		setContext: function () {
			Object.keys(self.instruments).forEach(function (k) {
				var instr = self.instruments[k];
				instr.ctxSetter && instr.ctxSetter(instr.value.value);
			});
		},
		initTools: function () {
			for (var tool in self.tools) {
				if (!self.tools.hasOwnProperty(tool)) continue;
				var t = self.tools[tool];
				t.icon.onclick = self.setMode.bind(self, tool);
				if (t.constructor) {
					t.constructor();
				}
			}
		},
		initButtons: function () {
			var buttons = {
				paintZoomIn: self.actions.zoomIn,
				paintZoomOut: self.actions.zoomOut,
				paintSend: self.actions.sendImage,
				paintClear: self.actions.clearCanvas,
				paintUndo: self.buffer.undo,
				paintRedo: self.buffer.redo
			};
			Object.keys(buttons).forEach(function (k) {
				$(k).onclick = buttons[k];
			});
		},
		initCanvas: function () {
			[
				{dom: self.dom.canvas, listener: 'mousedown', handler: 'onmousedown'},
				{dom: self.dom.container, listener: 'keypress', handler: 'contKeyPress', params: false},
				{dom: self.dom.container, listener: 'paste', handler: 'canvasImagePaste', params: false},
				{
					dom: self.dom.canvasWrapper, listener: mouseWheelEventName, handler: 'onmousewheel'
					, params: {passive: false}
				},
				{dom: self.dom.container, listener: 'drop', handler: 'canvasImageDrop', params: {passive: false}}
			].forEach(function (e) {
				e.dom.addEventListener(e.listener, self.events[e.handler], e.params);
			});
			self.dom.painterIcon.onclick = self.actions.initAndShow;
		},
		createFonts: function () {
			var select = self.instruments.font.value;
			var fonts = [
				'Arial, Helvetica, sans-serif',
				'"Arial Black", Gadget, sans-serif',
				'"Comic Sans MS", cursive, sans-serif',
				'Impact, Charcoal, sans-serif',
				'"Lucida Sans Unicode", "Lucida Grande", sans-serif',
				'Tahoma, Geneva, sans-serif',
				'"Trebuchet MS", Helvetica, sans-serif',
				'Verdana, Geneva, sans-serif',
				'"Courier New", Courier, monospace',
				'"Lucida Console", Monaco, monospace'
			];
			fonts.forEach(function (t) {
				var o = document.createElement('option');
				select.appendChild(o);
				o.textContent = t;
				o.style.fontFamily = t;
				o.value = t;
			});
		},
	};
	self.log = function () {
		var args = Array.prototype.slice.call(arguments);
		args.unshift("Painter");
		return logger.webrtc.apply(logger, args);
	};
	self.helper = {
		setCursor: function (fill, stroke, width) {
			if (width < 3) {
				width = 3;
			} else if (width > 126) {
				width = 126;
			}
			var svg = '<svg xmlns="http://www.w3.org/2000/svg" height="128" width="128"><circle cx="64" cy="64" r="{0}" fill="{1}"{2}/></svg>'.formatPos(width, fill, stroke);
			self.dom.canvas.style.cursor = 'url(data:image/svg+xml;base64,{}) {} {}, auto'.format(btoa(svg), 64, 64);
		},
		isNumberKey: function (evt) {
			var charCode = evt.which || evt.keyCode;
			return charCode > 47 && charCode < 58;
		},
		trimImage: function () { // TODO this looks bad
			var copy = document.createElement('canvas').getContext('2d'),
					pixels = self.ctx.getImageData(0, 0, self.dom.canvas.width, self.dom.canvas.height),
					l = pixels.data.length,
					i,
					bound = {
						top: null,
						left: null,
						right: null,
						bottom: null
					},
					x, y;
			for (i = 0; i < l; i += 4) {
				if (pixels.data[i + 3] !== 0) {
					x = (i / 4) % self.dom.canvas.width;
					y = ~~((i / 4) / self.dom.canvas.width);
					if (bound.top === null) {
						bound.top = y;
					}
					if (bound.left === null) {
						bound.left = x;
					} else if (x < bound.left) {
						bound.left = x;
					}
					if (bound.right === null) {
						bound.right = x;
					} else if (bound.right < x) {
						bound.right = x;
					}
					if (bound.bottom === null) {
						bound.bottom = y;
					} else if (bound.bottom < y) {
						bound.bottom = y;
					}
				}
			}
			var trimHeight = bound.bottom - bound.top,
					trimWidth = bound.right - bound.left;
			if (trimWidth && trimHeight) {
				var trimmed = self.ctx.getImageData(bound.left, bound.top, trimWidth, trimHeight);
				copy.canvas.width = trimWidth;
				copy.canvas.height = trimHeight;
				copy.putImageData(trimmed, 0, 0);
				return copy.canvas;
			} else {
				return false;
			}
		},
		applyZoom: function (isIncrease) {
			if (isIncrease) {
				self.zoom *= self.ZOOM_SCALE;
			} else {
				self.zoom /= self.ZOOM_SCALE;
			}
			if (self.tools[self.mode].onZoomChange) {
				self.tools[self.mode].onZoomChange(self.zoom);
			}
			self.dom.canvas.style.width = self.dom.canvas.width * self.zoom + 'px';
			self.dom.canvas.style.height = self.dom.canvas.height * self.zoom + 'px';
		},
		getScaledOrdinate: function (ordinateName/*width*/, value) {
			var clientOrdinateName = 'client' + ordinateName.charAt(0).toUpperCase() + ordinateName.substr(1);
			/*clientWidth*/
			var clientOrdinate = self.dom.canvas[clientOrdinateName];
			var ordinate = self.dom.canvas[ordinateName];
			return ordinate == clientOrdinate ? value : Math.round(ordinate * value / clientOrdinate); // apply page zoom
		},
		getXY: function (e) {
			return {
				x: self.helper.getScaledOrdinate('width', e.offsetX),
				y: self.helper.getScaledOrdinate('height', e.offsetY)
			}
		},
		setDimensions: function(w, h) {
			w = parseInt(w);
			h = parseInt(h);
			self.dom.canvas.width = w;
			self.dom.canvas.height = h;
			self.dom.paintDimensions.textContent = '{}x{}'.format(w, h);
		}
	};
	self.events = {
		mouseDown: 0,
		onmousedown: function (e) {
			var tool = self.tools[self.mode];
			if (!tool.onMouseDown) {
				return;
			}
			self.log("{} mouse down", self.mode)();
			self.events.mouseDown++;
			var rect = painter.dom.canvas.getBoundingClientRect();
			self.leftOffset = rect.left;
			self.topOffset = rect.top;
			var imgData;
			if (!tool.bufferHandler) {
				imgData = self.buffer.startAction();
			}
			tool.onMouseDown(e, imgData);
			if (tool.onMouseMove) {
				self.dom.canvas.addEventListener('mousemove', tool.onMouseMove);
			}
		},
		onmouseup: function (e) {
			if (self.events.mouseDown > 0) {
				self.events.mouseDown--;
				var tool = self.tools[self.mode];
				if (!tool.bufferHandler) {
					self.buffer.finishAction();
				}
				var mu = tool.onMouseUp;
				if (mu) {
					self.log("{} mouse up", self.mode)();
					mu(e)
				}
				if (tool.onMouseMove) {
					self.dom.canvas.removeEventListener('mousemove', tool.onMouseMove);
				}
			}
		},
		onmousewheel: function (e) {
			if (!e.ctrlKey) {
				return;
			}
			e.preventDefault();
			var xProp = e.offsetX / self.dom.canvasWrapper.scrollWidth;
			var yProp = e.offsetY / self.dom.canvasWrapper.scrollHeight;
			self.helper.applyZoom(e.detail < 0 || e.wheelDelta > 0); // isTop
			var newScrollWidth = xProp * self.dom.canvasWrapper.scrollWidth - (self.dom.canvasWrapper.clientWidth / 2);
			var newScrollHeight = yProp * self.dom.canvasWrapper.scrollHeight - (self.dom.canvasWrapper.clientHeight / 2);
			self.log("Zoomed to {}; newScrollOffset: {{}, {}} from proportion {{}, {}}",
					self.zoom.toFixed(2),
					Math.round(newScrollWidth),
					Math.round(newScrollHeight),
					xProp.toFixed(2),
					yProp.toFixed(2)
			)();
			self.dom.canvasWrapper.scrollTop = newScrollHeight;
			self.dom.canvasWrapper.scrollLeft = newScrollWidth;
		},
		contKeyPress: function (event) {
			self.log("keyPress: {} ({})", event.keyCode, event.code);
			if (event.keyCode === 13) {
				if (self.tools[self.mode].onApply) {
					self.tools[self.mode].onApply();
				} else {
					self.actions.sendImage();
				}
				// event.code if keyboard is different (e.g Russian)
			} else if (event.keyCode === 26 && event.ctrlKey || event.code === 'KeyZ') {
				self.buffer.undo();
			} else if (event.keyCode === 25 && event.ctrlKey || event.code === 'KeyY') {
				self.buffer.redo();
			}
		},
		canvasImageDrop: function (e) {
			e.preventDefault();
			self.setMode('img');
			self.tools.img.readAndPasteCanvas(e.dataTransfer.files[0]);
		},
		canvasImagePaste: function (e) {
			if (e.clipboardData && e.clipboardData.items) {
				for (var i = 0; i < e.clipboardData.items.length; i++) {
					var asFile = e.clipboardData.items[i].getAsFile();
					if (asFile && asFile.type.indexOf('image') >= 0) {
						self.setMode('img');
						self.tools.img.readAndPasteCanvas(asFile);
						self.preventDefault(e);
						return;
					}
				}
			}
		}
	};
	self.resizer = new (function() {
		var tool = this;
		tool.cursorStyle = document.createElement('style');
		document.head.appendChild(tool.cursorStyle);
		tool.imgHolder = $('paint-crp-rect');
		tool.params = {
			setWidth: function (w) {
				tool.imgHolder.style.width = tool.params.lastCoord.ow * self.zoom + w + 'px';
				tool.params.width = tool.params.lastCoord.ow + w / self.zoom;
			},
			setHeight: function (h) {
				tool.imgHolder.style.height = tool.params.lastCoord.oh * self.zoom + h + 'px';
				tool.params.height = tool.params.lastCoord.oh + h / self.zoom;
			},
			setTop: function (t) {
				tool.imgHolder.style.top = tool.params.lastCoord.oy * self.zoom + t + 'px';
				tool.params.top = tool.params.lastCoord.oy + t / self.zoom;
			},
			setLeft: function (l) {
				tool.imgHolder.style.left = tool.params.lastCoord.ox * self.zoom + l + 'px';
				tool.params.left = tool.params.lastCoord.ox + l / self.zoom;
			}
		};
		tool.setMode = function (m) {
			tool.mode = m;
		};
		tool.setData = function (t, l, w, h) {
			tool.params.top = t / self.zoom;
			tool.params.left = l / self.zoom;
			tool.params.width = w;
			tool.params.height = h;
			tool.imgHolder.style.left = l + 'px';
			tool.imgHolder.style.top = t + 'px';
			tool.imgHolder.style.width = w * self.zoom + 'px';
			tool.imgHolder.style.height = h * self.zoom + 'px';
		};
		tool._setCursor = function (cursor) {
			tool.cursorStyle.textContent = cursor ? "#paintPastedImg, #paint-crp-rect, #painter {cursor: {} !important}".format(cursor) : ""
		};
		tool.onZoomChange = function () {
			tool.imgHolder.style.width = tool.params.width * self.zoom + 'px';
			tool.imgHolder.style.height = tool.params.height * self.zoom + 'px';
			tool.imgHolder.style.top = tool.params.top * self.zoom + 'px';
			tool.imgHolder.style.left = tool.params.left * self.zoom + 'px';
		};
		tool.show = function() {
			CssUtils.showElement(tool.imgHolder);
			document.addEventListener('mouseup', tool.docMouseUp);
		};
		tool.hide = function() {
			CssUtils.hideElement(tool.imgHolder);
			document.removeEventListener('mouseup', tool.docMouseUp);
		};
		tool.imgHolder.onmousedown = function(e) {
			self.log("Resizer mousedown")();
			tool.mode = e.target.getAttribute('pos');
			self.dom.canvasWrapper.addEventListener('mousemove', tool.handleMouseMove);
			tool.setParamsFromEvent(e);
			tool._setCursor(tool.cursors[tool.mode]);
		};
		tool.setParamsFromEvent = function(e) {
			tool.params.lastCoord = {
				x: e.pageX,
				y: e.pageY,
				ox: tool.params.left, // origin x
				oy: tool.params.top, // origin y
				ow: tool.params.width, // origin width
				oh: tool.params.height, // origin height
				op: tool.params.width / tool.params.height // origin proportion
			};
			// ( lastCoord.op * x)^2 + x^2 = z;
			tool.params.lastCoord.nl = Math.pow(tool.params.lastCoord.op, 2) + 1;
		};
		tool.docMouseUp = function (e) {
			self.log("Resizer mouseup")();
			tool.mode = null;
			tool._setCursor(null);
			self.dom.canvasWrapper.removeEventListener('mousemove', tool.handleMouseMove);
		};
		tool.cursors = {
			m: 'move',
			b: 's-resize',
			t: 's-resize',
			l: 'e-resize',
			r: 'e-resize',
			tl: 'se-resize',
			br: 'se-resize',
			bl: 'ne-resize',
			tr: 'ne-resize'
		};
		tool.handlers = {
			m: function (x, y) {
				tool.params.setTop(+y);
				tool.params.setLeft(+x);
			},
			b: function (x, y) {
				tool.params.setHeight(+y);
			},
			t: function (x, y) {
				tool.params.setTop(+y);
				tool.params.setHeight(-y);
			},
			l: function (x, y) {
				tool.params.setLeft(+x);
				tool.params.setWidth(-x);
			},
			r: function (x, y) {
				tool.params.setWidth(+x);
			}
		};
		tool.calcProportion = function (x, y) {
			var d = {
				tl: {dx: 1, dy: 1},
				tr: {dx: 1, dy: -1},
				bl: {dx: -1, dy: 1},
				br: {dx: 1, dy: 1}
			}[tool.mode];
			var dx = x > 0 ? 1 : -1;
			var dy = y > 0 ? 1 : -1;
			var nl = x * x * dx * d.dx + y * y * dy * d.dy;
			var dnl = nl > 0 ? 1 : -1;
			var v = dnl * Math.sqrt(Math.abs(nl) / tool.params.lastCoord.nl);
			y = v * d.dy;
			x = v * tool.params.lastCoord.op * d.dx;
			return {x: x, y: y};
		};
		tool.handleMouseMove = function (e) {
			self.log("resizer mousmove")();
			var x = e.pageX - tool.params.lastCoord.x;
			var y = e.pageY - tool.params.lastCoord.y;
			if (e.shiftKey && tool.mode.length === 2) {
				var __ret = tool.calcProportion(x, y);
				x = __ret.x;
				y = __ret.y;
			}
			tool.handlers[tool.mode.charAt(0)](x, y);
			if (tool.mode.length === 2) {
				tool.handlers[tool.mode.charAt(1)](x, y);
			}
		};
	})();
	self.tools = {
		eraser: new (function () {
			var tool = this;
			tool.icon = $('paintEraser');
			tool.setCursor = function () {
				self.helper.setCursor('#aaaaaa', ' stroke="black" stroke-width="2"', self.ctx.lineWidth);
			};
			tool.onChangeRadius = function (e) {
				tool.setCursor();
			};
			tool.onActivate = function () {
				tool.tmpAlpha = self.ctx.globalAlpha;
				self.ctx.globalAlpha = 1;
				self.ctx.globalCompositeOperation = "destination-out";
			};
			tool.onDeactivate = function () {
				self.ctx.globalAlpha = tool.tmpAlpha;
			};
			tool.onMouseDown = function (e) {
				var coord = self.helper.getXY(e);
				self.ctx.moveTo(coord.x, coord.y);
				self.ctx.beginPath();
				tool.onMouseMove(e)
			};
			tool.onMouseMove = function (e) {
				var coord = self.helper.getXY(e);
				self.ctx.lineTo(coord.x, coord.y);
				self.ctx.stroke();
			};
			tool.onMouseUp = function () {
				self.ctx.closePath();
			};
		})(),
		img: new (function () {
			var tool = this;
			tool.icon = $('paintPasteImg');
			tool.img = $('paintPastedImg');
			tool.bufferHandler = true;
			tool.imgObj = null;
			tool.readAndPasteCanvas = function (file) {
				var reader = new FileReader();
				reader.readAsDataURL(file);
				reader.onload = function (event) {
					tool.imgObj = new Image();
					var b64 = event.target.result;
					tool.imgObj.onload = function () {
						tool.img.src = b64;
						self.resizer.setData(
								10 + self.dom.canvasWrapper.scrollTop,
								10 + self.dom.canvasWrapper.scrollLeft,
								tool.imgObj.width,
								tool.imgObj.height
						);
					};
					tool.imgObj.src = b64;
				};
			};
			tool.setCursor = function () {
				self.dom.canvas.style.cursor = null;
			};
			tool.onApply = function (event) {
				var data = self.buffer.startAction();
				var params = self.resizer.params;
				var applyBuff = false;
				var nw = params.left + params.width;
				var nh = params.top + params.height;
				if (nw > self.dom.canvas.width || nh > self.dom.canvas.height) {
					self.helper.setDimensions(
							Math.max(nw, self.dom.canvas.width),
							Math.max(nh, self.dom.canvas.height)
					);
					self.ctx.putImageData(data, 0, 0);
				}
				self.ctx.drawImage(tool.imgObj,
						0, 0, tool.imgObj.width, tool.imgObj.height,
						params.left, params.top, params.width, params.height);
				self.buffer.finishAction();
				self.setMode('pen');
			};
			tool.onZoomChange = self.resizer.onZoomChange;
			tool.onActivate = function(e) {
				self.resizer.show();
				CssUtils.showElement(tool.img);
			};
			tool.onDeactivate = function() {
				self.resizer.hide();
				CssUtils.hideElement(tool.img);
			};
		}),
		crop: new (function () {
			var tool = this;
			tool.icon = $('paintCrop');
			tool.bufferHandler = true;
			tool.setCursor = function () {
				self.dom.canvas.style.cursor = 'crosshair';
			};
			tool.onApply = function () {
				var params = self.resizer.params;
				self.buffer.startAction();
				var img = self.ctx.getImageData(params.left, params.top, params.width, params.height);
				self.helper.setDimensions(params.width, params.height);
				self.ctx.putImageData(img, 0, 0);
				self.buffer.finishAction(img);
				self.setMode('pen');
			};
			tool.onZoomChange = self.resizer.onZoomChange;
			tool.onDeactivate = function() {
				self.resizer.hide();
			};
			tool.onMouseDown = function (e) {
				self.resizer.show();
				self.resizer.setData(e.offsetY, e.offsetX, 0, 0);
				self.resizer.setParamsFromEvent(e);
				self.resizer.setMode('br');
			};
			tool.onMouseMove = function(e) {
				self.log("Crop mousmove")();
				self.resizer.handleMouseMove(e);
			};
			tool.onMouseUp = function (e) {

			};
		})(),
		resize: new (function () {
			var tool = this;
			tool.icon = $('paintResize');
			tool.container = $('paintResizeTools');
			tool.width = tool.container.querySelector('[placeholder=width]');
			tool.height = tool.container.querySelector('[placeholder=height]');
			tool.lessThan4 = function(e) {
				if (this.value.length > 4) {
					this.value = this.value.slice(0, 4);
				}
			};
			tool.onlyNumber = function(e) {
				var charCode = e.which || e.keyCode;
				return  charCode > 47 && charCode < 58;
			};
			tool.width.onkeypress = tool.onlyNumber;
			tool.width.oninput = tool.lessThan4;
			tool.height.oninput = tool.lessThan4;
			tool.height.onkeypress = tool.onlyNumber;
			tool.onApply = function() {
				self.buffer.startAction();
				self.helper.setDimensions(tool.width.value, tool.height.value);
				self.buffer.finishAction();
				self.setMode('pen')
			};
			tool.setCursor = function() {
				self.dom.canvas.style.cursor = '';
			};
			tool.onActivate = function() {
				CssUtils.showElement(tool.container);
				tool.width.value = self.dom.canvas.width;
				tool.height.value = self.dom.canvas.height;
			};
			tool.onDeactivate = function() {
				CssUtils.hideElement(tool.container);
			};
		}),
		pen: new (function () {
			var tool = this;
			tool.icon = $('paintPen');
			tool.onChangeColor = function (e) {
				tool.setCursor();
			};
			tool.onChangeRadius = function (e) {
				tool.setCursor();
			};
			tool.onChangeOpacity = function (e) {
				tool.setCursor();
			};
			tool.setCursor = function () {
				self.helper.setCursor(self.ctx.strokeStyle, '', self.ctx.lineWidth);
			};
			tool.onActivate = function () {
				self.ctx.lineJoin = 'round';
				self.ctx.lineCap = 'round';
				self.ctx.globalCompositeOperation = "source-over";
			};
			tool.onMouseDown = function (e, data) {
				var coord = self.helper.getXY(e);
				self.ctx.moveTo(coord.x, coord.y);
				tool.points = [];
				tool.tmpData = data;
				tool.onMouseMove(e)
			};
			tool.onMouseMove = function (e) {
				// self.log("mouse move,  points {}", JSON.stringify(tool.points))();
				var coord = self.helper.getXY(e);
				self.ctx.putImageData(tool.tmpData, 0, 0);
				tool.points.push(coord);
				self.ctx.beginPath();
				self.ctx.moveTo(tool.points[0].x, tool.points[0].y);
				for (var i = 0; i < tool.points.length; i++) {
					self.ctx.lineTo(tool.points[i].x, tool.points[i].y);
				}
				self.ctx.stroke();
			};
			tool.onMouseUp = function (e) {
				self.ctx.closePath();
				tool.points = [];
				tool.tmpData = null;
			};
		}),
		move: new (function () {
			var tool = this;
			tool.icon = $('paintMove');
			tool.setCursor = function () {
				self.dom.canvas.style.cursor = 'move';
			};
			tool.onMouseDown = function (e) {
				tool.lastCoord = {x: e.pageX, y: e.pageY};
			};
			tool.onMouseMove = function (e) {
				var x = tool.lastCoord.x - e.pageX;
				var y = tool.lastCoord.y - e.pageY;
				self.log("Moving to: {{}, {}}", x, y)();
				self.dom.canvasWrapper.scrollTop += y;
				self.dom.canvasWrapper.scrollLeft += x;
				tool.lastCoord = {x: e.pageX, y: e.pageY};
				// self.log('X,Y: {{}, {}}', self.dom.canvasWrapper.scrollLeft, self.dom.canvasWrapper.scrollTop )();
			};
			tool.onMouseUp = function (coord) {
				tool.lastCoord = null;
			};
		}),
		text: new (function () {
			var tool = this;
			tool.span = $('paintTextSpan');
			tool.icon = $('paintText');
			//prevent self.events.contKeyPress
			tool.span.addEventListener('keypress', function (e) {
				if (e.keyCode !== 13 || e.shiftKey) {
					e.stopPropagation(); //proxy onapply
				}
			});
			tool.bufferHandler = true;
			tool.onChangeFont = function (e) {
				tool.span.style.fontFamily = e.target.value;
			};
			tool.onActivate = function () { // TODO this looks bad
				tool.onChangeFont({target: {value: self.ctx.fontFamily}});
				tool.onChangeRadius({target: {value: self.ctx.lineWidth}});
				tool.onChangeOpacity({target: {value: self.ctx.globalAlpha * 100}});
				tool.onChangeColor({target: {value: self.ctx.strokeStyle}});
				tool.span.innerHTML = '';
			};
			tool.onDeactivate = function () {
				CssUtils.hideElement(tool.span);
			};
			tool.onApply = function () {
				self.buffer.startAction();
				self.ctx.fillStyle = self.ctx.strokeStyle;
				self.ctx.font = "{}px {}".format(5 + self.ctx.lineWidth, self.ctx.fontFamily);
				var width = 5 + self.ctx.lineWidth; //todo lineheight causes so many issues
				var lineheight = parseInt(width * 1.25);
				var linediff = parseInt(width * 0.01);
				var lines = tool.span.textContent.split('\n');
				for (var i = 0; i < lines.length; i++) {
					self.ctx.fillText(lines[i], tool.lastCoord.x, width + i * lineheight + tool.lastCoord.y - linediff);
				}
				self.buffer.finishAction();
				self.setMode('pen');
			};
			tool.onZoomChange = function () {
				tool.span.style.fontSize = (self.zoom * (self.ctx.lineWidth + 5)) + 'px';
				tool.span.style.top = (tool.originOffest.y * self.zoom  / tool.originOffest.z) + 'px';
				tool.span.style.left = (tool.originOffest.x * self.zoom  / tool.originOffest.z) + 'px';
			};
			tool.setCursor = function () {
				self.dom.canvas.style.cursor = 'crosshair';
			};
			tool.onChangeRadius = function (e) {
				tool.span.style.fontSize = (self.zoom * (5 + parseInt(e.target.value))) + 'px';
			};
			tool.onChangeOpacity = function (e) {
				tool.span.style.opacity = e.target.value / 100
			};
			tool.onChangeColor = function (e) {
				tool.span.style.color = e.target.value;
			};
			tool.onMouseDown = function (e) {
				CssUtils.showElement(tool.span);
				tool.originOffest = {
					x: e.offsetX,
					y: e.offsetY,
					z: self.zoom,
				};
				tool.span.style.top = tool.originOffest.y +'px';
				tool.span.style.left = tool.originOffest.x +'px';
				tool.lastCoord = self.helper.getXY(e);
				setTimeout(function (e) {
					tool.span.focus()
				});
			};
		})
	};
	self.actions = {
		clearCanvas: function () {
			self.buffer.startAction();
			self.ctx.clearRect(0, 0, parseInt(self.dom.canvas.width), parseInt(self.dom.canvas.height));
			self.buffer.finishAction();
		},
		sendImage: function () {
			var trimImage = self.helper.trimImage();
			if (trimImage) {
				Utils.pasteb64ImgToTextArea(trimImage.toDataURL());
				self.hide();
			} else {
				growlError("You can't paste empty images");
			}
		},
		zoomIn: function () {
			self.helper.applyZoom(true);
		},
		zoomOut: function () {
			self.helper.applyZoom(false);
		},
		initAndShow: function () {
			self.show();
			self.buffer.clear();
			self.helper.setDimensions(
					self.dom.canvasWrapper.offsetWidth - 2,
					self.dom.canvasWrapper.offsetHeight - 6
			);
			self.init.setContext();
			self.setMode('pen');
		},
	};
	self.buffer = new (function () {
		var tool = this;
		var undoImages = [];
		var redoImages = [];
		var current = null;
		tool.getCanvasImage = function (img) {
			return {
				width: self.dom.canvas.width,
				height: self.dom.canvas.height,
				data: img || self.ctx.getImageData(0, 0, self.dom.canvas.width, self.dom.canvas.height)
			}
		};
		tool.clear = function () {
			undoImages = [];
			redoImages = [];
			current = null;
		};
		tool.dodo = function(from, to) {
			var restore = from.pop();
			if (restore) {
				to.push(current);
				current = restore;
				if (self.dom.canvas.width != current.width || self.dom.canvas.height != current.height) {
					self.log("Resizing canvas from {}x{} to {}x{}",
							self.dom.canvas.width, self.dom.canvas.height,
							current.width, current.height
					)();
					self.helper.setDimensions(current.width, current.height)
				}
				self.ctx.putImageData(restore.data, 0, 0);
			}
		};
		tool.redo = function () {
			tool.dodo(redoImages, undoImages);
		};
		tool.undo = function () {
			tool.dodo(undoImages, redoImages);
		};
		tool.finishAction = function (img) {
			if (current) {
				undoImages.push(current);
			}
			redoImages = [];
			current = tool.getCanvasImage(img);
		};
		tool.startAction = function () {
			if (!current) {
				current = tool.getCanvasImage();
			}
			return current.data;
		};
	})();
	self.setMode = function (mode) {
		var oldMode = self.tools[self.mode];
		self.mode = mode;
		if (oldMode) {
			oldMode.onDeactivate && oldMode.onDeactivate();
			if (oldMode.onMouseMove) {
				self.dom.canvas.removeEventListener('mousemove', oldMode.onMouseMove);
			}
			CssUtils.removeClass(oldMode.icon, self.PICKED_TOOL_CLASS);
		}
		var newMode = self.tools[self.mode];
		newMode.onActivate && newMode.onActivate();
		newMode.setCursor && newMode.setCursor();
		newMode.icon && CssUtils.addClass(newMode.icon, self.PICKED_TOOL_CLASS);
		Object.keys(self.instruments).forEach(function (k) {
			var instr = self.instruments[k];
			if (oldMode && oldMode[instr.handler]) {
				CssUtils.hideElement(instr.holder);
			}
			if (newMode[instr.handler]) {
				CssUtils.showElement(instr.holder);
			}
		});
	};
	self.show = function () {
		self.super.show();
		document.body.addEventListener('mouseup', self.events.onmouseup, false);
	};
	self.superHide = self.hide;
	self.hide = function () {
		self.superHide();
		document.body.removeEventListener('mouseup', self.events.onmouseup, false);
	};
	Object.keys(self.init).forEach(function (k) {
		self.init[k]()
	});
}


function NotifierHandler() {
	var self = this;
	self.maxNotifyTime = 300;
	self.currentTabId = Date.now().toString();
	/*This is required to know if this tab is the only one and don't spam with same notification for each tab*/
	self.LAST_TAB_ID_VARNAME = 'lastTabId';
	self.clearNotificationTime = 5000;
	self.askPermissions = function () {
		if (notifications && Notification.permission !== "granted") {
			Notification.requestPermission();
		}
	};
	self.popedNotifQueue = [];
	self.init = function () {
		window.addEventListener("blur", self.onFocusOut);
		window.addEventListener("focus", self.onFocus);
		window.addEventListener("beforeunload", self.onUnload);
		window.addEventListener("unload", self.onUnload);
		self.onFocus();
		if (!window.Notification) {
			logger.warn("Notification is not supported")();
		} else {
			self.askPermissions();
		}
	};
	self.notificationClick = function () {
		window.focus();
		this.close()
	};
	self.lastNotifyTime = Date.now();
	self.notify = function (title, message, icon) {
		if (self.isCurrentTabActive) {
			return;
		}
		self.newMessagesCount++;
		document.title = self.newMessagesCount + " new messages";
		if (navigator.vibrate) {
			navigator.vibrate(200);
		}
		var currentTime = Date.now();
		// last opened tab not this one, leave the oppotunity to show notification from last tab
		if (!window.Notification || !self.isTabMain() || !notifications || currentTime - self.maxNotifyTime < self.lastNotifyTime) {
			return
		}
		self.askPermissions();
		var notification = new Notification(title, {
			icon: icon || NOTIFICATION_ICON_URL,
			body: message
		});
		self.popedNotifQueue.push(notification);
		self.lastNotifyTime = currentTime;
		notification.onclick = self.notificationClick;
		notification.onclose = function () {
			self.popedNotifQueue.pop(this);
		};
		setTimeout(self.clearNotification, self.clearNotificationTime);
	};
	self.isTabMain = function () {
		var activeTab = localStorage.getItem(self.LAST_TAB_ID_VARNAME);
		if (activeTab == "0") {
			localStorage.setItem(self.LAST_TAB_ID_VARNAME, self.currentTabId);
			activeTab = self.currentTabId;
		}
		return activeTab == self.currentTabId;
	};
	self.onUnload = function () {
		if (self.unloaded) {
			return
		}
		if (self.isTabMain) {
			localStorage.setItem(self.LAST_TAB_ID_VARNAME, "0");
		}
		self.unloaded = true;
	};
	self.clearNotification = function () {
		if (self.popedNotifQueue.length > 0) {
			var notif = self.popedNotifQueue[0];
			notif.close();
			self.popedNotifQueue.shift();
		}
	};
	self.onFocus = function () {
		localStorage.setItem(self.LAST_TAB_ID_VARNAME, self.currentTabId);
		self.isCurrentTabActive = true;
		self.newMessagesCount = 0;
		document.title = 'PyChat';
	};
	self.onFocusOut = function () {
		self.isCurrentTabActive = false
	};
	self.init();
}


function Page() {
	var self = this;
	self.dom = {
		container: document.body,
		el: []
	};
	self.setParams = function (params) {
		if (params) {
			logger.warn('Params are not set for {}', self.getUrl())();
		}
	};
	self.render = function () {
		doGet(self.getUrl(), self.onLoad);
	};
	self.onLoad = function (html) {
		var tmpWrapper = document.createElement('div');
		tmpWrapper.innerHTML = html;
		var holder = tmpWrapper.firstChild;
		self.dom.el.push(holder);
		self.dom.container.appendChild(holder);
		self.fixTitle();
	};
	self.foreach = function (apply) {
		for (var i = 0; i < self.dom.el.length; i++) {
			apply(self.dom.el[i]);
		}
	};
	self.setTitle = function (newTitle) {
		self.title = newTitle;
	};
	self.getDefaultTitle = function () {
		return "<b>{}</b>".format(loggedUser);
	};
	self.fixTitle = function () {
		var newTittle = self.getTitle();
		if (newTittle != null) {
			headerText.innerHTML = newTittle;
		} else {
			headerText.innerHTML = self.getDefaultTitle();
		}
	};
	self.show = function () {
		self.rendered = true;
		self.fixTitle();
		self.foreach(CssUtils.showElement);
	};
	self.update = self.show;
	self.hide = function () {
		self.foreach(CssUtils.hideElement);
	};
	self.getUrl = function () {
		return self.url;
	};
	self.getTitle = function () {
		return self.title;
	};
	self.super = {
		onLoad: self.onLoad,
		hide: self.hide,
		show: self.show,
		dom: self.dom
	};
	self.title = self.getDefaultTitle();
	self.toString = function () {
		return self.name;
	};
}

function IssuePage() {
	var self = this;
	Page.call(self);
	self.url = '/report_issue';
	self.title = 'Report issue';
	self.dom = {
		issueForm: $('issueForm'),
		version: $("version"),
		issue: $("issue")
	};
	self.dom.el = [self.dom.issueForm];
	self.show = function () {
		self.super.show();
		self.dom.issue.focus();
	};
	self.update = self.show;
	self.render = function () {
		self.dom.version.value = window.browserVersion;
		self.dom.issue.addEventListener('input', function () {
			self.dom.issue.style.height = 'auto';
			var textAreaHeight = issue.scrollHeight;
			self.dom.issue.style.height = textAreaHeight + 'px';
		});
		self.dom.issueForm.onsubmit = self.onsubmit;
		self.show();
	};
	self.onsubmit = function (event) {
		event.preventDefault();
		var params = {};
		if ($('history').checked) {
			if (logger.historyStorage != null) {
				params['log'] = logger.historyStorage
			}
		}
		doPost('/report_issue', params, function (response) {
			if (response === RESPONSE_SUCCESS) {
				growlSuccess("Your issue has been successfully submitted");
				singlePage.showDefaultPage();
			} else {
				growlError(response);
			}
		}, self.dom.issueForm);
	};
}

function ViewProfilePage() {
	var self = this;
	Page.call(self);
	self.getUrl = function () {
		return '/profile/{}'.format(self.userId);
	};
	self.setParams = function (params) {
		self.setUserId(params[0]);
	};
	self.getTitle = function () {
		self.username = self.username || self.dom.el[0].getAttribute('username');
		return "<b>{}</b>'s profile".format(self.username);
	};
	self.setUserId = function (userId) {
		self.userId = userId;
	}
}

function ChangeProfilePage() {
	var self = this;
	Page.call(self);
	self.url = '/profile';
	self.title = "<b>{}</b> (your) profile".format(loggedUser);
	self.onLoad = function (html) {
		self.rendered = true;
		self.super.onLoad(html);
		doGet(CHANGE_PROFILE_JS_URL, function () {
			initChangeProfile();
		});
	}
}


function AmchartsPage() {
	var self = this;
	Page.call(self);
	self.title = 'Statistics';
	self.url = '/statistics';
	self.render = function () {
		self.rendered = true;
		doGet(AMCHART_URL, function () {
			var holder = document.createElement("div");
			self.dom.el.push(holder);
			self.dom.container.appendChild(holder);
			holder.setAttribute("id", "chartdiv");
			holder.className = 'max-height-scrollable';
			doGet(self.url, function (data) {
				window.amchartJson = JSON.parse(data);
				doGet(STATISTICS_JS_URL, self.show);
			});
		});
	};
	self.update = self.show;
}


function PageHandler() {
	var self = this;
	self.pages = {
		'/report_issue': new IssuePage(),
		'/chat/': channelsHandler,
		'/statistics': new AmchartsPage(),
		'/profile/': new ViewProfilePage(),
		'/profile': new ChangeProfilePage()
	};
	self.pageRegex = /\w\/#(\/\w+\/?)(.*)/g;
	self.init = function () {
		self.showPageFromUrl();
		window.onhashchange = self.showPageFromUrl;
	};
	self.getPage = function (url) {
		return self.pages[url];
	};
	self.updateTitle = function () {
		self.currentPage.fixTitle();
	};
	self.showPageFromUrl = function () {
		var currentUrl = window.location.href;
		var match = self.pageRegex.exec(currentUrl);
		var params;
		var page;
		if (match) {
			page = match[1];
			var handler = self.getPage(page);
			if (match[2]) {
				params = match[2].split('/');
			}
			if (handler) {
				self.showPage(page, params, true);
			} else {
				self.showDefaultPage();
			}
		} else {
			self.showDefaultPage();
		}
	};
	self.showDefaultPage = function () {
		self.showPage('/chat/', [DEFAULT_CHANNEL_NAME]);
	};
	self.pushHistory = function () {
		var historyUrl = "#{}".format(self.currentPage.getUrl());
		// TODO remove triple, carefull of undefined tittle in ViewProfilePage
		window.history.pushState(historyUrl, historyUrl, historyUrl);
	};
	self.showPage = function (page, params, dontHistory) {
		logger.info('Rendering page "{}"', page)();
		if (self.currentPage) self.currentPage.hide();
		self.currentPage = self.pages[page];
		if (self.currentPage.rendered) {
			self.currentPage.update(params);
		} else {
			self.currentPage.setParams(params);
			self.currentPage.render();
		}
		if (!dontHistory) {
			self.pushHistory(dontHistory);
		}
	};
	self.init();
}


function ChannelsHandler() {
	var self = this;
	Page.call(self);
	self.url = '/chat/';
	self.render = self.show;
	self.ROOM_ID_ATTR = 'roomid';
	self.activeChannel = DEFAULT_CHANNEL_NAME;
	self.HIGHLIGHT_MESSAGE_CLASS = 'highLightMessage';
	self.channels = {};
	self.childDom = {
		wrapper: $('wrapper'),
		userMessageWrapper: $('userMessageWrapper'),
		chatUsersTable: $("chat-user-table"),
		rooms: $("rooms"),
		activeUserContext: null,
		userContextMenu: $('user-context-menu'),
		addUserHolder: $('addUserHolder'),
		addRoomHolder: $('addRoomHolder'),
		addRoomInput: $('addRoomInput'),
		addUserList: $('addUserList'),
		addUserInput: $('addUserInput'),
		addRoomButton: $('addRoomButton'),
		directUserTable: $('directUserTable'),
		imgInput: $('imgInput'),
		imgInputIcon: $('imgInputIcon'),
		usersStateText: $('usersStateText'),
		inviteUser: $('inviteUser'),
		navCallIcon: $('navCallIcon'),
		webRtcFileIcon: $('webRtcFileIcon'),
		m2Message: $('m2Message')
	};
	self.getActiveChannel = function () {
		return self.channels[self.activeChannel];
	};
	self.childDom.minifier = {
		channel: {
			icon: $('channelsMinifier'),
			body: self.childDom.rooms
		},
		direct: {
			icon: $('directMinifier'),
			body: self.childDom.directUserTable
		},
		user: {
			icon: $('usersMinifier'),
			body: self.childDom.chatUsersTable
		}
	};
	for (var attrname in self.dom) {
		if (self.dom.hasOwnProperty(attrname)) {
			self.childDom[attrname] = self.dom[attrname];
		}
	}
	self.dom = self.childDom;
	delete self.childDom;
	self.dom.el = [
		self.dom.wrapper,
		self.dom.userMessageWrapper
	];
	self.getUrl = function () {
		return self.url + self.activeChannel;
	};
	self.update = function (params) {
		self.setActiveChannel(self.parseActiveChannelFromParams(params));
		self.show();
	};
	self.parseActiveChannelFromParams = function (params) {
		if (params && params.length > 0) {
			var res = parseInt(params[0]);
			return isNaN(res) ? null : res;
		}
	};
	self.clearChannelHistory = function () {
		localStorage.clear();
		self.getActiveChannel().clearHistory();
		logger.info('History has been cleared')();
		growlSuccess('History has been cleared');
	};
	self.setParams = function (params) {
		self.activeChannel = self.parseActiveChannelFromParams(params);
	};
	self.roomClick = function (event) {
		var target = event.target;
		var tagName = target.tagName;
		if (tagName == 'UL') {
			return;
		}
		// liEl = closest parent with LI
		var liEl = tagName == 'I' || tagName == 'SPAN' ? target.parentNode : target;
		var roomId = parseInt(liEl.getAttribute(self.ROOM_ID_ATTR));
		if (CssUtils.hasClass(target, CANCEL_ICON_CLASS_NAME)) {
			wsHandler.sendToServer({
				action: 'deleteRoom',
				roomId: roomId
			});
		} else {
			self.setActiveChannel(roomId);
		}
	};
	self.setActiveChannel = function (key) {
		self.removeEditingMode();
		self.hideActiveChannel();
		self.activeChannel = key;
		self.showActiveChannel();
		singlePage.pushHistory();
	};
	self.showActiveChannel = function () {
		var chatHandler = self.getActiveChannel();
		if (chatHandler == null) {
			singlePage.showDefaultPage();
		} else {
			chatHandler.show();
			if (chatHandler.isPrivate()) {
				CssUtils.hideElement(self.dom.inviteUser);
			} else {
				CssUtils.showElement(self.dom.inviteUser);
			}
		}
		userMessage.focus()
	};
	self.toggleChannelOfflineOnline = function () {
		var isOnline = CssUtils.toggleClass(self.dom.chatUsersTable, 'hideOffline');
		self.dom.usersStateText.textContent = isOnline ? "Channel online" : "Channel users";
	};
	self.hideActiveChannel = function () {
		if (self.activeChannel && self.getActiveChannel()) {
			self.getActiveChannel().hide()
		}
	};
	self.sendMessage = function (messageRequest) {
		// anonymous is set by name, registered user is set by id.
		var buHtml = userMessage.innerHTML;
		var sendSuccessful = wsHandler.sendToServer(messageRequest);
		userMessage.innerHTML = sendSuccessful ? "" : buHtml;
	};
	self.handleFileSelect = function (evt) {
		var files = evt.target.files;
		Utils.pasteImgToTextArea(files[0]);
		self.dom.imgInput.value = "";
	};
	self.preventDefault = function (e) {
		e.preventDefault();
	};
	self.imageDrop = function (evt) {
		self.preventDefault(evt);
		var file = evt.dataTransfer.files[0];
		if (file) {
			if (file.type.indexOf("image") >= 0) {
				Utils.pasteImgToTextArea(file);
			} else {
				webRtcApi.offerFile(file, self.activeChannel);
			}
		}
	};
	self.imagePaste = function (e) {
		if (e.clipboardData) {
			var items = e.clipboardData.items;
			if (items && items.length > 0) {
				var prevent = false;
				for (var i = 0; i < items.length; i++) {
					var asFile = items[i].getAsFile();
					if (asFile) {
						prevent = true;
						Utils.pasteImgToTextArea(asFile);
					}
				}
				if (prevent) {
					self.preventDefault(e);
				}
			}
		}
	};
	self.showM2EditMenu = function (event, el, messageId, time) {
		event.preventDefault();
		event.stopPropagation();
		self.removeEditingMode();
		CssUtils.showElement(self.dom.m2Message);
		CssUtils.addClass(el, channelsHandler.HIGHLIGHT_MESSAGE_CLASS);
		self.dom.m2Message.style.top = event.pageY - 20 + 'px';
		self.dom.m2Message.style.left = event.pageX - 5 + 'px';
		document.addEventListener('click', self.hideM2EditMessage);
		self.editLastMessageNode = {
			dom: el,
			id: messageId,
			notReady: true,
			time: time
		}
	};
	self.showM2ContextDelete = function (event) {
		var el = event.target;
		while (el != self.dom.chatBoxDiv) {
			if (el.tagName == 'P') {
				var strMessageId = el.getAttribute(MESSAGE_ID_ATTRIBUTE);
				if (strMessageId) {
					var messageId = parseInt(strMessageId);
					var time = parseInt(el.id);
					var selector = "[{}='{}']:not(.{}) .{}".format(
							MESSAGE_ID_ATTRIBUTE,
							strMessageId,
							REMOVED_MESSAGE_CLASSNAME,
							SELF_HEADER_CLASS
					);
					var p = document.querySelector(selector);
					if (p && self.isMessageEditable(time)) {
						self.showM2EditMenu(event, el, messageId, time);
					}
				}
			} else if (el.tagName == 'IMG') { // show default menu on images
				break;
			}
			el = el.parentNode;
		}
	};
	self.hideM2EditMessage = function () {
		self.removeEditingMode();
		document.removeEventListener('click', self.hideM2EditMessage);
		CssUtils.hideElement(self.dom.m2Message);
	};
	self.m2EditMessage = function () {
		self.editLastMessageNode.notReady = false;
		var selector = '[id="{}"] .{}'.format(self.editLastMessageNode.time, CONTENT_STYLE_CLASS);
		userMessage.innerHTML = document.querySelector(selector).innerHTML;
		self.placeCaretAtEnd();
		event.stopPropagation();
		document.removeEventListener('click', self.hideM2EditMessage);
		CssUtils.hideElement(self.dom.m2Message);
	};
	self.m2DeleteMessage = function () {
		wsHandler.sendToServer({
			id: self.editLastMessageNode.id,
			action: 'editMessage',
			content: null
		});
		// eventPropagande will execute onclick on document.body that will hide contextMenu
	};
	self.handleEditMessage = function (event) {
		if (!blankRegex.test(userMessage.textContent)) {
			return;
		}
		var editLastMessageNode = self.getActiveChannel().lastMessage;
		// only if message was sent 10 min ago + 2seconds for message to being processed
		if (editLastMessageNode && self.isMessageEditable(editLastMessageNode.time)) {
			self.editLastMessageNode = editLastMessageNode;
			self.editLastMessageNode.dom = $(editLastMessageNode.time);
			if (!self.editLastMessageNode.dom) { //if history has been cleared
				return
			}
			CssUtils.addClass(self.editLastMessageNode.dom, self.HIGHLIGHT_MESSAGE_CLASS);
			var selector = '[id="{}"] .{}'.format(editLastMessageNode.time, CONTENT_STYLE_CLASS);
			userMessage.innerHTML = document.querySelector(selector).innerHTML;
			self.placeCaretAtEnd();
			event.preventDefault();
		}
	};
	self.isMessageEditable = function (time) {
		return time + 595000 > Date.now();
	};
	self.placeCaretAtEnd = function () {
		var range = document.createRange();
		range.selectNodeContents(userMessage);
		range.collapse(false);
		var sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	};
	self.nextChar = function (c) {
		return String.fromCharCode(c.charCodeAt(0) + 1)
	};
	self.getPastedImage = function (currSymbol) {
		var res = {}; // return array from nodeList
		var images = userMessage.querySelectorAll('.' + PASTED_IMG_CLASS);
		for (var i = 0; i < images.length; i++) {
			var img = images[i];
			var elSymbol = img.getAttribute('symbol');
			if (!elSymbol) {
				currSymbol = self.nextChar(currSymbol);
				elSymbol = currSymbol;
			}
			var textNode = document.createTextNode(elSymbol);
			img.parentNode.replaceChild(textNode, img);
			if (!img.getAttribute('symbol')) { // don't send image again, it's already in server
				res[elSymbol] = {
					b64: img.src,
					fileName: img.getAttribute('fileName')
				};
			}
		}
		return res;
	};
	self.handleSendMessage = function () {
		var isEdit = self.editLastMessageNode && !self.editLastMessageNode.notReady;
		var currSymbol = '\u3500'; // it's gonna increase in getPastedImage
		if (isEdit && self.editLastMessageNode.dom) {
			// dom can be null if we cleared the history
			// in this case symbol will be parsed in be
			var newSymbol = self.editLastMessageNode.dom.getAttribute('symbol');
			if (newSymbol) {
				currSymbol = newSymbol;
			}
		}
		var images = self.getPastedImage(currSymbol);
		smileyUtil.purgeImagesFromSmileys();
		var messageContent = userMessage.textContent;
		messageContent = blankRegex.test(messageContent) ? null : messageContent;
		var message;
		if (isEdit) {
			message = {
				id: self.editLastMessageNode.id,
				action: 'editMessage',
				images: images,
				content: messageContent
			};
			self.removeEditingMode();
		} else if (messageContent) {
			message = {
				images: images,
				action: 'sendMessage',
				content: messageContent,
				channel: self.activeChannel
			};
		} else {
			return;
		}
		self.sendMessage(message);
	};
	self.checkAndSendMessage = function (event) {
		if (event.keyCode === 13 && !event.shiftKey) { // 13 = enter
			event.preventDefault();
			self.handleSendMessage();
		} else if (event.keyCode === 27) { // 27 = escape
			smileyUtil.hideSmileys();
			self.removeEditingMode();
		} else if (event.keyCode === 38) { // up arrow
			self.handleEditMessage(event);
		}
	};
	self.removeEditingMode = function () {
		if (self.editLastMessageNode) {
			CssUtils.removeClass(self.editLastMessageNode.dom, self.HIGHLIGHT_MESSAGE_CLASS);
			self.editLastMessageNode = null;
			userMessage.innerHTML = "";
		}
	};
	self.addUserHolderClick = function (event) {
		var target = event.target;
		if (target.tagName != 'LI') {
			return
		}
		var userId = parseInt(target.getAttribute(USER_ID_ATTR));
		var message = {
			action: self.addUserHolderAction,
			userId: userId
		};
		if (self.addUserHolderAction == 'inviteUser') {
			message.roomId = self.getActiveChannel().roomId;
		}
		wsHandler.sendToServer(message);
		self.addUserHandler.hide();
	};
	self.showAddRoom = function () {
		self.addRoomHandler.show();
		self.dom.addRoomInput.focus();
	};
	self.showInviteUser = function () {
		var activeChannel = self.getActiveChannel();
		var exclude = activeChannel.allUsers;
		var isEmpty = self.fillAddUser(exclude);
		if (isEmpty) {
			growlInfo("All users are already in the channel");
			return;
		}
		self.addUserHandler.show();
		self.dom.addUserInput.focus();
		self.addUserHolderAction = 'inviteUser';
		self.addUserHandler.setHeaderText("Invite user to room <b>{}</b>".format(activeChannel.roomName));
	};
	self.inviteUser = function (message) {
		self.createNewRoomChatHandler(message.roomId, message.name, message.content);
	};
	self.fillAddUser = function (excludeUsersId) {
		self.dom.addUserList.innerHTML = '';
		self.addUserUsersList = {};
		var allUsers = self.getAllUsersInfo();
		for (var userId in allUsers) {
			if (!allUsers.hasOwnProperty(userId)) continue;
			if (excludeUsersId[userId]) continue;
			var li = document.createElement('LI');
			var username = allUsers[userId].user;
			self.addUserUsersList[username] = li;
			li.innerText = username;
			li.setAttribute(USER_ID_ATTR, userId);
			self.dom.addUserList.appendChild(li);
		}
		if (self.dom.addUserList.childNodes.length === 0) return true;
	};
	self.getDirectMessagesUserIds = function () {
		var els = document.querySelectorAll('#directUserTable li');
		var res = {};
		for (var i = 0; i < els.length; i++) {
			var userId = els[i].getAttribute(USER_ID_ATTR);
			res[userId] = true;
		}
		return res;
	};
	self.showAddUser = function () {
		var exclude = self.getDirectMessagesUserIds();
		var isEmpty = self.fillAddUser(exclude);
		if (isEmpty) {
			growlInfo("You already have all users in direct channels");
			return;
		}
		self.addUserHandler.show();
		self.addUserHolderAction = 'addDirectChannel';
		self.addUserHandler.setHeaderText("Create Direct Channel");
		self.dom.addUserInput.focus();
	};
	self.getAllUsersInfo = function () {
		return self.channels[DEFAULT_CHANNEL_NAME].allUsers;
	};
	self.filterAddUser = function (event) {
		var filterValue = self.dom.addUserInput.value;
		if (event.keyCode === 13) {
			if (self.addUserUsersList[filterValue]) {
				self.addUserHolderClick({target: self.addUserUsersList[filterValue]});
				return;
			}
		}
		for (var userName in self.addUserUsersList) {
			if (!self.addUserUsersList.hasOwnProperty(userName)) continue;
			if (userName.indexOf(filterValue) > -1) {
				CssUtils.showElement(self.addUserUsersList[userName]);
			} else {
				CssUtils.hideElement(self.addUserUsersList[userName]);
			}
		}
	};
	self.createDirectChannel = function () {
		var userId = self.getActiveUserId();
		var exclude = self.getDirectMessagesUserIds();
		if (exclude[userId]) {
			document.querySelector("#directUserTable li[userid='{}']".format(userId)).click();
		} else {
			wsHandler.sendToServer({
				action: 'addDirectChannel',
				userId: userId
			});
		}
	};
	self.finishAddRoom = function () {
		var roomName = self.dom.addRoomInput.value;
		var sendSucc = wsHandler.sendToServer({
			action: 'addRoom',
			name: roomName
		});
		if (sendSucc) {
			self.addRoomHandler.hide()
		}
	};
	self.finishAddRoomOnEnter = function (event) {
		if (event.keyCode === 13) { // enter
			self.finishAddRoom();
		}
	};
	self.getAnotherUserId = function (allUsersIds) {
		var anotherUserId;
		if (allUsersIds.length == 2) {
			anotherUserId = allUsersIds[0] == '' + loggedUserId ? allUsersIds[1] : allUsersIds[0];
		} else {
			anotherUserId = allUsersIds[0];
		}
		return anotherUserId;
	};
	self.createChannelChatHandler = function (roomId, li, users, roomName) {
		var i = document.createElement('span');
		i.className = CANCEL_ICON_CLASS_NAME;
		li.appendChild(i);
		li.setAttribute(self.ROOM_ID_ATTR, roomId);
		var chatBoxDiv = document.createElement('div');
		userMessage.onpaste = self.imagePaste;
		chatBoxDiv.ondrop = self.imageDrop;
		chatBoxDiv.ondragover = self.preventDefault;
		self.channels[roomId] = new ChatHandler(li, chatBoxDiv, users, roomId, roomName);
		self.channels[roomId].dom.chatBoxDiv.oncontextmenu = self.showM2ContextDelete;
	};
	self.createNewUserChatHandler = function (roomId, users) {
		var allUsersIds = Object.keys(users);
		var anotherUserId = self.getAnotherUserId(allUsersIds);
		var roomName = users[anotherUserId].user;
		var li = Utils.createUserLi(anotherUserId, users[anotherUserId].sex, roomName);
		self.dom.directUserTable.appendChild(li);
		self.createChannelChatHandler(roomId, li, users, roomName);
		return anotherUserId;
	};
	self.createNewRoomChatHandler = function (roomId, roomName, users) {
		var li = document.createElement('li');
		self.dom.rooms.appendChild(li);
		li.innerHTML = roomName;
		self.createChannelChatHandler(roomId, li, users, roomName);
	};
	self.getCurrentRoomIDs = function () {

	};
	self.destroyChannel = function (channelKey) {
		logger.info("Destroying channel {} while offline", channelKey)();
		self.channels[channelKey].destroy();
		delete self.channels[channelKey];
	};
	self.setRooms = function (message) {
		var rooms = message.content;
		for (var channelKey in self.channels) {
			if (!self.channels.hasOwnProperty(channelKey)) continue;
			if (!rooms[channelKey]) {
				self.destroyChannel(channelKey);
			}
		}
		for (var roomId in rooms) {
			// if a new room has been added while disconnected
			if (!rooms.hasOwnProperty(roomId)) continue;
			var newRoom = rooms[roomId];
			var oldRoom = self.channels[roomId];
			var newUserList = newRoom.users;
			if (oldRoom) {
				oldRoom.updateAllDomUsers(newUserList);
			} else {
				var roomName = newRoom.name;
				logger.info("Creating new room '{}' with id {} while offline", roomName, roomId)();
				if (roomName) {
					self.createNewRoomChatHandler(roomId, roomName, newUserList);
				} else {
					self.createNewUserChatHandler(roomId, newUserList);
				}
			}
		}
		self.showActiveChannel();
		if (!self.roomsInited) {
			storage.loadMessagesFromLocalStorage();
		}
		self.roomsInited = true;
	};
	self.handle = function (message) {
		if (message.handler === 'channels') {
			self[message.action](message);
		} else if (message.handler === 'chat') {
			var channelHandler = self.channels[message.channel];
			if (!channelHandler) {
				throw 'Unknown channel {} for message "{}"'.format(message.channel, JSON.stringify(message));
			}
			channelHandler[message.action](message);
			self.executePostUserAction(message);
		}
	};
	self.executePostUserAction = function (message) {
		if (self.postUserAction) {
			if (self.postUserAction.time + 30000 > Date.now()) {
				if (self.postUserAction.actionTrigger == message.action
						&& self.postUserAction.userId == message.userId) {
					logger.info("Proceeding postUserAction {}", self.postUserAction)();
					self.postUserAction.action();
					self.postUserAction = null;
				}
			} else {
				self.postUserAction = null;
			}
		}
	};
	self.deleteRoom = function (message) {
		var roomId = message.roomId;
		var userId = message.userId;
		var handler = self.channels[roomId];
		if (handler.dom.roomNameLi.getAttribute('userid') || userId == loggedUserId) {
			self.destroyChannel(roomId);
			growlInfo("<div>Channel <b>{}</b> has been deleted</div>".format(handler.dom.roomNameLi.textContent));
			if (self.activeChannel == roomId) {
				self.setActiveChannel(DEFAULT_CHANNEL_NAME);
			}
		} else {
			handler.removeUser(message)
		}
	};
	self.addDirectChannel = function (message) {
		var users = message.users;
		var anotherUserName = self.getAllUsersInfo();
		var channelUsers = {};
		// dont assign, close the structure so changes in 1 room don't affect others
		channelUsers[users[1]] = Object.assign({}, anotherUserName[users[1]]);
		channelUsers[users[0]] = Object.assign({}, anotherUserName[users[0]]);
		var anotherUserId = self.createNewUserChatHandler(message.roomId, channelUsers);
		self.setActiveChannel(message.roomId);
		growlInfo('<span>Room for user <b>{}</b> has been created</span>'.format(anotherUserName[anotherUserId].user));
	};
	self.addRoom = function (message) {
		var users = message.users;
		var roomName = message.name;
		var channelUsers = {};
		channelUsers[users[0]] = self.getAllUsersInfo()[users[0]];
		self.createNewRoomChatHandler(message.roomId, roomName, channelUsers);
		growlInfo('<span>Room <b>{}</b> has been created</span>'.format(roomName));
	};
	self.viewProfile = function () {
		singlePage.showPage('/profile/', [self.getActiveUserId()]);
	};
	self.init = function () {
		self.dom.chatUsersTable.addEventListener('contextmenu', self.showContextMenu, false);
		self.dom.rooms.onclick = self.roomClick;
		self.dom.directUserTable.onclick = self.roomClick;
		self.dom.imgInput.onchange = self.handleFileSelect;
		self.dom.imgInputIcon.onclick = function () {
			self.dom.imgInput.click()
		};
		self.dom.addRoomInput.onkeypress = self.finishAddRoomOnEnter;
		self.dom.addRoomButton.onclick = self.finishAddRoom;
		self.addUserHandler = new Draggable(self.dom.addUserHolder, "");
		self.addRoomHandler = new Draggable(self.dom.addRoomHolder, "Create New Room");
		var minifier = self.dom.minifier;
		for (var el in minifier) {
			if (minifier.hasOwnProperty(el)) {
				minifier[el].icon.onclick = self.minifyList;
			}
		}
		self.dom.usersStateText.onclick = self.toggleChannelOfflineOnline;
		self.dom.usersStateText.click();
	};
	self.minifyList = function (event) {
		var minifier = self.dom.minifier[event.target.getAttribute('name')];
		var visible = CssUtils.toggleVisibility(minifier.body);
		minifier.icon.className = visible ? 'icon-angle-circled-down' : 'icon-angle-circled-up';

	};
	self.getActiveUserId = function () {
		return parseInt(self.dom.activeUserContext.getAttribute(USER_ID_ATTR));
	};
	self.getActiveUsername = function () {
		return self.dom.activeUserContext.textContent;
	};
	self.m2Call = function () {
		self.showOrInviteDirectChannel(self.postCallUserAction);
	};
	self.postCallUserAction = function () {
		self.getActiveChannel().getCallHandler().offerCall();
	};
	self.postCallTransferFileAction = function () {
		webRtcApi.toggleCallContainer();
	};
	self.m2TransferFile = function () {
		self.showOrInviteDirectChannel(self.postCallTransferFileAction);
		webRtcApi.dom.fileInput.value = null;
		webRtcApi.dom.fileInput.click();
	};
	self.showOrInviteDirectChannel = function (postAction) {
		var userId = self.getActiveUserId();
		var exclude = self.getDirectMessagesUserIds();
		if (userId == loggedUserId) {
			growlError("You can't call yourself");
		} else if (exclude[userId]) {
			var selector = "#directUserTable li[userid='{}']".format(userId);
			var strRoomId = document.querySelector(selector).getAttribute(self.ROOM_ID_ATTR);
			self.setActiveChannel(parseInt(strRoomId));
			postAction();
		} else {
			self.postUserAction = {
				action: postAction,
				time: Date.now(),
				userId: userId,
				actionTrigger: 'addOnlineUser'
			};
			wsHandler.sendToServer({
				action: 'addDirectChannel',
				userId: userId
			});
		}
	};
	self.dom.activeUserContext = null;
	self.showContextMenu = function (e) {
		var li = e.target;
		if (li.tagName == 'I') {
			li = li.parentElement;
		} else if (li.tagName != 'LI') {
			return;
		}
		if (self.dom.activeUserContext != null) {
			CssUtils.removeClass(self.dom.activeUserContext, 'active-user');
		}
		self.dom.activeUserContext = li;
		self.dom.userContextMenu.style.top = li.offsetTop + li.clientHeight + "px";
		CssUtils.addClass(self.dom.activeUserContext, 'active-user');
		CssUtils.showElement(self.dom.userContextMenu);
		document.addEventListener("click", self.removeContextMenu);
		e.preventDefault();
	};
	self.removeContextMenu = function () {
		CssUtils.hideElement(self.dom.userContextMenu);
		document.removeEventListener("click", self.removeContextMenu);
		CssUtils.removeClass(self.dom.activeUserContext, 'active-user');
	};
	self.init();
}


function SmileyUtil() {
	var self = this;
	self.dom = {
		smileParentHolder: $('smileParentHolder')
	};
	self.smileRegex = /<img[^>]*code="([^"]+)"[^>]*>/g;
	self.tabNames = [];
	self.smileyDict = {};
	self.inited = false;
	self.init = function (smileys_bas64_data) {
		if (self.inited) {
			return;
		}
		self.inited = true;
		self.loadSmileys(smileys_bas64_data);
		userMessage.addEventListener("mousedown", function (event) {
			event.stopPropagation(); // Don't fire onDocClick
		});
	};
	self.hideSmileys = function () {
		document.removeEventListener("mousedown", self.onDocClick);
		CssUtils.hideElement(self.dom.smileParentHolder);
	};
	self.onDocClick = function (event) {
		event = event || window.event;
		event.preventDefault(); //don't lose focus on usermessage
		self.hideSmileys();
	};
	self.purgeImagesFromSmileys = function () {
		userMessage.innerHTML = userMessage.innerHTML.replace(self.smileRegex, "$1");
	};
	self.addSmile = function (event) {
		event.preventDefault(); // prevents from losing focus
		event.stopPropagation(); // don't allow onDocClick
		var smileImg = event.target;
		if (smileImg.tagName !== 'IMG') {
			return;
		}
		Utils.pasteHtmlAtCaret(smileImg.cloneNode());
		logger.info('Added smile "{}"', smileImg.alt)();
	};
	self.encodeSmileys = function (html) {
		return html.replace(smileUnicodeRegex, function (s) {
			return self.smileyDict[s];
		});
	};
	self.toggleSmileys = function (event) {
		event.stopPropagation(); // prevent top event
		event.preventDefault();
		var becomeHidden = CssUtils.toggleVisibility(self.dom.smileParentHolder);
		if (becomeHidden) {
			document.removeEventListener("mousedown", self.onDocClick);
		} else {
			document.addEventListener("mousedown", self.onDocClick);
			if (document.activeElement != userMessage) {
				userMessage.focus();
			}
		}
	};
	self.showTabByName = function (eventOrTabName) {
		var tagName;
		if (eventOrTabName.target) { // if called by actionListener
			if (eventOrTabName.target.tagName !== 'LI') {
				// outer scope click
				return;
			}
			eventOrTabName.stopPropagation();
			eventOrTabName.preventDefault();
			tagName = eventOrTabName.target.innerHTML;
		} else {
			tagName = eventOrTabName;
		}
		for (var i = 0; i < self.tabNames.length; i++) {
			CssUtils.hideElement($("tab-" + self.tabNames[i])); // loadSmileys currentSmileyHolderId
			CssUtils.removeClass($("tab-name-" + self.tabNames[i]), 'activeTab');
		}
		CssUtils.showElement($("tab-" + tagName));
		CssUtils.addClass($("tab-name-" + tagName), 'activeTab');
	};

	self.loadSmileys = function (jsonData) {
		//var smileyData = JSON.parse(jsonData);
		var smileyData = jsonData;
		for (var tab in smileyData) {
			if (!smileyData.hasOwnProperty(tab)) continue;
			var tabRef = document.createElement('div');
			tabRef.setAttribute("name", tab);
			var tabName = document.createElement("LI");
			tabName.setAttribute("id", "tab-name-" + tab);
			var textNode = document.createTextNode(tab);
			tabName.appendChild(textNode);
			$("tabNames").appendChild(tabName);
			var currentSmileyHolderId = "tab-" + tab;
			tabRef.setAttribute("id", currentSmileyHolderId);
			self.tabNames.push(tab);
			self.dom.smileParentHolder.appendChild(tabRef);

			var tabSmileys = smileyData[tab];
			for (var smile in tabSmileys) {
				if (!tabSmileys.hasOwnProperty(smile)) continue;
				var fileRef = document.createElement('IMG');
				var fullSmileyUrl = "data:image/gif;base64," + tabSmileys[smile].base64;
				fileRef.setAttribute("src", fullSmileyUrl);
				fileRef.setAttribute("code", smile);
				fileRef.setAttribute("alt", tabSmileys[smile].text_alt);
				tabRef.appendChild(fileRef);
				// http://stackoverflow.com/a/1750860/3872976
				/** encode dict key, so {@link encodeSmileys} could parse smileys after encoding */
				self.smileyDict[encodeHTML(smile)] = fileRef.outerHTML;
			}
		}
		self.showTabByName(Object.keys(smileyData)[0]);
	};
}


function ChatHandler(li, chatboxDiv, allUsers, roomId, roomName) {
	var self = this;
	self.UNREAD_MESSAGE_CLASS = 'unreadMessage';
	self.EDITED_MESSAGE_CLASS = 'editedMessage';
	self.roomId = parseInt(roomId);
	self.roomName = roomName;
	self.lastMessage = {};
	self.dom = {
		chatBoxDiv: chatboxDiv,
		userList: document.createElement('ul'),
		roomNameLi: li,
		newMessages: document.createElement('span'),
		deleteIcon: li.lastChild,
		chatBoxHolder: $('chatBoxHolder'),
		chatLogin: $("chatLogin"),
		chatLogout: $("chatLogout"),
		chatIncoming: $("chatIncoming"),
		chatOutgoing: $("chatOutgoing")
	};
	self.dom.userList.setAttribute('roomId', roomId);
	self.newMessages = 0;
	self.lastLoadUpHistoryRequest = 0;
	self.allMessages = [];
	self.allMessagesDates = [];
	self.activeRoomClass = 'active-room';
	self.dom.newMessages.className = 'newMessagesCount ' + CssUtils.visibilityClass;
	li.appendChild(self.dom.newMessages);
	self.OTHER_HEADER_CLASS = 'message-header-others';
	self.dom.userList.className = CssUtils.visibilityClass;
	channelsHandler.dom.chatUsersTable.appendChild(self.dom.userList);
	self.dom.chatBoxDiv.className = 'chatbox ' + CssUtils.visibilityClass;
	self.dom.chatBoxHolder.appendChild(self.dom.chatBoxDiv);
	// tabindex allows focus, focus allows keydown binding event
	self.dom.chatBoxDiv.setAttribute('tabindex', '1');
	self.show = function () {
		self.rendered = true;
		CssUtils.showElement(self.dom.chatBoxDiv);
		CssUtils.showElement(self.dom.userList);
		CssUtils.addClass(self.dom.roomNameLi, self.activeRoomClass);
		self.removeNewMessages();
		CssUtils.hideElement(self.dom.newMessages);
		CssUtils.showElement(self.dom.deleteIcon);
		if (self.callHandler) {
			self.callHandler.restoreState()
		}
	};
	/*==================== DOM EVENTS LISTENERS ============================*/
// keyboard and mouse handlers for loadUpHistory
// Those events are removed when loadUpHistory() reaches top
	self.mouseWheelLoadUp = function (e) {
		// IE has inverted scroll,
		var isTopDirection = e.detail < 0 || e.wheelDelta > 0; // TODO check all browser event name deltaY?
		if (isTopDirection) {
			self.loadUpHistory(10);
		}
	};
	self.removeNewMessages = function () {
		self.newMessages = 0;
		CssUtils.hideElement(self.dom.newMessages);
	};
	self.dom.chatBoxDiv.addEventListener(mouseWheelEventName, self.mouseWheelLoadUp, {passive: true});
	self.keyDownLoadUp = function (e) {
		if (e.which === 33) {    // page up
			self.loadUpHistory(25);
		} else if (e.which === 38) { // up
			self.loadUpHistory(10);
		} else if (e.ctrlKey && e.which === 36) {
			self.loadUpHistory(35);
		}
	};
	self.clearHistory = function () {
		self.headerId = null;
		self.dom.chatBoxDiv.innerHTML = '';
		self.allMessages = [];
		self.allMessagesDates = [];
		self.dom.chatBoxDiv.addEventListener(mouseWheelEventName, self.mouseWheelLoadUp, {passive: true});
		self.dom.chatBoxDiv.addEventListener("keydown", self.keyDownLoadUp);
	};
	self.dom.chatBoxDiv.addEventListener('keydown', self.keyDownLoadUp);
	self.hide = function () {
		CssUtils.hideElement(self.dom.chatBoxDiv);
		if (self.callHandler) {
			self.callHandler.hide();
		}
		CssUtils.hideElement(self.dom.userList);
		CssUtils.removeClass(self.dom.roomNameLi, self.activeRoomClass);
	};
	self.getCallHandler = function () {
		if (!self.callHandler) {
			self.callHandler = new CallHandler(self.roomId);
		}
		return self.callHandler;
	};
	self.createCallHandler = function () {
		if (self.callHandler && self.callHandler.callInProggress) {
			return false;
		} else if (self.callHandler) {
			self.callHandler.closeEvents();
			return self.callHandler;
		} else {
			self.callHandler = new CallHandler(self.roomId);
			self.callHandler.toggle(); // I mean hide + set this.visible
			return self.callHandler;
		}
	};
	self.toggleCallHandler = function () {
		if (self.callHandler) {
			self.callHandler.toggle();
		} else {
			self.getCallHandler();
		}
	};
	self.isPrivate = function () {
		return self.dom.roomNameLi.hasAttribute(USER_ID_ATTR);
	};
	self.getOpponentId = function () {
		return self.dom.roomNameLi.getAttribute(USER_ID_ATTR);
	};
	self.getUserNameById = function (id) {
		return self.allUsers[id] ? self.allUsers[id].user : null;
	};
	self.addUserToDom = function (message) {
		if (!self.allUsers[message.userId]) {
			self.allUsers[message.userId] = {
				sex: message.sex,
				user: message.user
			};
			self.addUserLi(message.userId, message.sex, message.user);
		}
	};
	self.updateAllDomUsers = function (newUsers) {
		for (var oldUserId in self.allUsers) {
			if (!self.allUsers.hasOwnProperty(oldUserId)) continue;
			if (!newUsers[oldUserId]) {
				var oldLi = document.querySelector('ul[roomId="{}"] > li[userId="{}"]'.format(self.roomId, oldUserId));
				CssUtils.deleteElement(oldLi);
				logger.info("User with id {} has been deleted while offline", oldUserId)();
				delete self.allUsers[oldUserId];
			}
		}
		for (var newUserId in newUsers) {
			if (!newUsers.hasOwnProperty(newUserId)) continue;
			var newUser = newUsers[newUserId];
			if (!self.allUsers[newUserId]) {
				self.allUsers[newUserId] = newUser;
				logger.info("User with id {} has been signed up while offline", newUserId)();
				self.addUserLi(newUserId, newUser.sex, newUser.user);
			}
		}
	};
	self.setAllDomUsers = function (users) {
		self.dom.userList.innerHTML = '';
		self.allUsers = users;
		for (var userId in self.allUsers) {
			if (!self.allUsers.hasOwnProperty(userId)) continue;
			var user = self.allUsers[userId];
			self.addUserLi(userId, user.sex, user.user);
		}
	};
	self.addUserLi = function (userId, sex, username) {
		var li = Utils.createUserLi(userId, sex, username);
		li.className = 'offline';
		self.allUsers[userId].li = li;
		self.dom.userList.appendChild(li);
	};
	self.setAllDomUsers(allUsers);
	self.isHidden = function () {
		return CssUtils.isHidden(self.dom.chatBoxDiv);
	};
	/** Inserts element in the middle if it's not there
	 * @param time element
	 * @returns Node element that follows the inserted one
	 * @throws exception if element already there*/
	self.getPosition = function (time) {
		var arrayEl;
		for (var i = 0; i < self.allMessages.length; i++) {
			arrayEl = self.allMessages[i];
			if (time === arrayEl) {
				throw "Already in list";
			}
			if (time < arrayEl) {
				self.allMessages.splice(i, 0, time);
				return $(arrayEl);
			}
		}
		return null;
	};
	self.removeUser = function (message) {
		//if (self.onlineUsers.indexOf(message.userId) >= 0) {
		//	message.content = self.onlineUsers;
		//	self.printChangeOnlineStatus('has left the conversation.', message, chatLogout);
		//}
		var user = self.allUsers[message.userId];
		CssUtils.deleteElement(user.li);
		var dm = 'User <b>{}</b> has left the conversation'.format(user.user);
		self.displayPreparedMessage(SYSTEM_HEADER_CLASS, message.time, dm, SYSTEM_USERNAME);
		delete self.allUsers[message.userId];
	};
	self.timeMessageClick = function (event) {
		var value = userMessage.innerHTML;
		var match = value.match(timePattern);
		var oldText = match ? value.substr(match[0].length) : value;
		userMessage.innerHTML = '{}>>> {}'.format(event.target.parentElement.parentElement.textContent, oldText);
		userMessage.focus();
	};
	/** Creates a DOM node with attached events and all message content*/
	self.createMessageNode = function (timeMillis, headerStyle, displayedUsername, htmlEncodedContent, messageId) {
		var date = new Date(timeMillis);
		var time = [sliceZero(date.getHours()), sliceZero(date.getMinutes()), sliceZero(date.getSeconds())].join(':');

		var p = document.createElement('p');
		p.setAttribute("id", timeMillis);
		if (messageId) {
			p.setAttribute(MESSAGE_ID_ATTRIBUTE, messageId);
		}
		var headSpan = document.createElement('span');
		headSpan.className = headerStyle; // note it's not appending classes, it sets all classes to specified
		var timeSpan = document.createElement('span');
		timeSpan.className = TIME_SPAN_CLASS;
		timeSpan.textContent = '({})'.format(time);
		timeSpan.onclick = self.timeMessageClick;
		headSpan.appendChild(timeSpan);

		var userNameA = document.createElement('span');
		userNameA.textContent = displayedUsername;
		headSpan.insertAdjacentHTML('beforeend', ' ');
		headSpan.appendChild(userNameA);
		headSpan.insertAdjacentHTML('beforeend', ': ');
		p.appendChild(headSpan);
		var textSpan = document.createElement('span');
		textSpan.className = CONTENT_STYLE_CLASS;
		textSpan.innerHTML = htmlEncodedContent;
		p.appendChild(textSpan);
		return p;
	};
	/**Insert ------- Mon Dec 21 2015 ----- if required
	 * @param pos {Node} element of following message
	 * @param timeMillis {number} current message
	 * @returns Node element that follows the place where new message should be inserted
	 * */
	self.insertCurrentDay = function (timeMillis, pos) {
		var innerHTML = new Date(timeMillis).toDateString();
		//do insert only if date is not in chatBoxDiv
		var insert = self.allMessagesDates.indexOf(innerHTML) < 0;
		var fieldSet;
		if (insert) {
			self.allMessagesDates.push(innerHTML);
			fieldSet = document.createElement('fieldset');
			var legend = document.createElement('legend');
			legend.setAttribute('align', 'center');
			fieldSet.appendChild(legend);
			legend.textContent = innerHTML;
		}
		var result;
		if (pos != null) { // position of the following message <p>
			var prevEl = pos.previousSibling;
			// if it's not the same day block, prevElement always exist its either fieldset  either prevmessage
			result = (prevEl.tagName === 'FIELDSET' && prevEl.textContent.trim() !== innerHTML) ? prevEl : pos;
			if (insert) {
				self.dom.chatBoxDiv.insertBefore(fieldSet, result);
			}
		} else {
			if (insert) self.dom.chatBoxDiv.appendChild(fieldSet);
			result = null;
		}
		return result;
	};
	/** Inserts a message to positions, saves is to variable and scrolls if required*/
	self.displayPreparedMessage = function (headerStyle, timeMillis, htmlEncodedContent, displayedUsername, messageId, symbol) {
		var pos = null;
		if (self.allMessages.length > 0 && !(timeMillis > self.allMessages[self.allMessages.length - 1])) {
			try {
				pos = self.getPosition(timeMillis);
			} catch (err) {
				logger.warn("Skipping duplicate message, time: {}, content: <<<{}>>> ",
						timeMillis, htmlEncodedContent)();
				return;
			}
		} else {
			self.allMessages.push(timeMillis);
		}
		var p = self.createMessageNode(timeMillis, headerStyle, displayedUsername, htmlEncodedContent, messageId);
		// every message has UTC millis ID so we can detect if message is already displayed or position to display
		if (symbol) {
			p.setAttribute('symbol', symbol)
		}
		pos = self.insertCurrentDay(timeMillis, pos);
		if (pos != null) {
			self.dom.chatBoxDiv.insertBefore(p, pos);
		} else {
			var oldscrollHeight = self.dom.chatBoxDiv.scrollHeight;
			self.dom.chatBoxDiv.appendChild(p);
			if (htmlEncodedContent.startsWith('<img')) {
				(function (id, oldScrollHeight) {
					document.querySelector('[id="{}"] img'.format(id)).addEventListener('load', function () {
						self.scrollBottom(oldScrollHeight);
					});
				})(p.id, oldscrollHeight);
			} else {
				self.scrollBottom(oldscrollHeight);
			}
		}
		return p;
	};
	self.scrollBottom = function (oldscrollHeight) {
		var newscrollHeight = self.dom.chatBoxDiv.scrollHeight;
		if (newscrollHeight > oldscrollHeight) {
			self.dom.chatBoxDiv.scrollTop = newscrollHeight;
		}
	};
	self.loadOfflineMessages = function (data) {
		var messages = data.content || [];
		var oldSound = window.sound;
		window.sound = 0;
		messages.forEach(self.printNewMessage);
		window.sound = oldSound;
	};
	self.setHeaderId = function (headerId) {
		if (!self.headerId || headerId < self.headerId) {
			self.headerId = headerId;
		}
	};
	self.encodeMessage = function (data) {
		var html = encodeAnchorsHTML(data.content);
		if (data.images && Object.keys(data.images).length) {
			html = html.replace(imageUnicodeRegex, function (s) {
				return "<img src=\'{}\' symbol=\'{}\' class=\'{}\'/>".format(data.images[s], s, PASTED_IMG_CLASS);
			});
		}
		return smileyUtil.encodeSmileys(html);
	};
	self.getMaxSymbol = function (images) { //deprecated
		var symbols = images && Object.keys(images);
		if (symbols && symbols.length) {
			var symbol = '\u3501';
			for (var i = 0; i < symbols.length; i++) {
				if (symbols[i].charCodeAt(0) > symbol.charCodeAt(0)) {
					symbol = symbols[i]
				}
			}
			return symbol;
		}

	};
	self.editMessage = function (data) {
		var p = $(data.time);
		if (p != null) {
			var html = self.encodeMessage(data);
			var element = p.querySelector("." + CONTENT_STYLE_CLASS);
			if (data.symbol) {
				p.setAttribute('symbol', data.symbol);
			}
			element.innerHTML = html;
			CssUtils.addClass(p, self.EDITED_MESSAGE_CLASS);
		}
	};
	self.deleteMessage = function (data) {
		var target = document.querySelector("[id='{}'] .{}".format(data.time, CONTENT_STYLE_CLASS));
		if (target) {
			target.innerHTML = 'This message has been removed.';
			CssUtils.addClass($(data.time), REMOVED_MESSAGE_CLASSNAME);
			if (data.userId == loggedUserId) {
				self.lastMessage = null;
			}
		}
	};
	self.printNewMessage = function (data) {
		self._printMessage(data, true);
	};
	self.printMessage = function (data) {
		self._printMessage(data, false);
	};
	self._printMessage = function (data, isNew) {
		self.setHeaderId(data.id);
		self.printMessagePlay(data);
		var displayedUsername = self.allUsers[data.userId].user;
		var html = self.encodeMessage(data);
		var p = self.displayPreparedMessage(
				data.userId == loggedUserId ? SELF_HEADER_CLASS : self.OTHER_HEADER_CLASS,
				data.time,
				html,
				displayedUsername,
				data.id,
				data.symbol
		);
		if (p) { // not duplicate message
			self.highLightMessageIfNeeded(p, displayedUsername, isNew, data.content, data.images);
		}
	};
	self.printMessagePlay = function (data) {
		if (loggedUserId === data.userId) {
			Utils.checkAndPlay(self.dom.chatOutgoing);
			self.lastMessage = {
				id: data.id,
				time: data.time
			}
		} else {
			Utils.checkAndPlay(self.dom.chatIncoming);
		}
	};
	self.highLightMessageIfNeeded = function (p, displayedUsername, isNew, content, images) {
		var keys = images && Object.keys(images);
		var img = keys && images[keys[0]];
		notifier.notify(displayedUsername, content || 'images', img);
		if (self.isHidden() && !window.newMessagesDisabled) {
			self.newMessages++;
			self.dom.newMessages.textContent = self.newMessages;
			if (self.newMessages == 1) {
				CssUtils.showElement(self.dom.newMessages);
				CssUtils.hideElement(self.dom.deleteIcon);
			}
		}
		// if flag newMessagesDisabled wasn't set to true  && (...))
		if (!window.newMessagesDisabled && (self.isHidden() || isNew || !notifier.isCurrentTabActive)) {
			CssUtils.addClass(p, self.UNREAD_MESSAGE_CLASS);
			p.onmouseover = function (event) {
				var pTag = event.target;
				pTag.onmouseover = null;
				CssUtils.removeClass(pTag, self.UNREAD_MESSAGE_CLASS);
			}
		}
	};
	self.loadMessages = function (data) {
		var windowsSoundState = window.sound;
		window.sound = 0;
		logger.info('appending messages to top')();
		// This check should fire only once,
		// because requests aren't being sent when there are no event for them, thus no responses
		var message = data.content;
		if (message.length === 0) {
			logger.info('Requesting messages has reached the top, removing loadUpHistoryEvent handlers')();
			self.dom.chatBoxDiv.removeEventListener(mouseWheelEventName, self.mouseWheelLoadUp);
			self.dom.chatBoxDiv.removeEventListener("keydown", self.keyDownLoadUp);
			return;
		}
		// loadMessages could be called from localStorage
		var savedNewMessagesDisabledStatus = window.newMessagesDisabled;
		window.newMessagesDisabled = true;
		message.forEach(self.printMessage);
		window.newMessagesDisabled = savedNewMessagesDisabledStatus;
		self.lastLoadUpHistoryRequest = 0; // allow fetching again, after new header is set
		window.sound = windowsSoundState;
	};
	self.addOnlineUser = function (message) {
		self.addUserToDom(message);
		self.printChangeOnlineStatus('appeared online.', message, self.dom.chatLogin);
	};
	self.removeOnlineUser = function (message) {
		self.printChangeOnlineStatus('gone offline.', message, self.dom.chatLogout);
	};
	self.printChangeOnlineStatus = function (action, message, sound) {
		var dm;
		var username = self.allUsers[message.userId].user;
		if (message.userId == loggedUserId) {
			dm = 'You have ' + action;
		} else {
			dm = 'User <b>{}</b> has {}'.format(username, action);
		}
		Utils.checkAndPlay(sound);
		self.displayPreparedMessage(SYSTEM_HEADER_CLASS, message.time, dm, SYSTEM_USERNAME);
		self.setOnlineUsers(message);
	};
	self.setOnlineUsers = function (message) {
		self.onlineUsers = message.content;
		logger.info("Load user names: {}", Object.keys(self.onlineUsers))();
		for (var userId in self.allUsers) {
			if (!self.allUsers.hasOwnProperty(userId)) continue;
			var user = self.allUsers[userId];
			if (self.onlineUsers.indexOf(parseInt(userId)) >= 0) {
				CssUtils.removeClass(user.li, 'offline');
			} else {
				CssUtils.addClass(user.li, 'offline');
			}
		}
	};
	self.loadUpHistory = function (count) {
		if (self.dom.chatBoxDiv.scrollTop === 0) {
			var currentMillis = Date.now();
			// 0 if locked, or last request was sent earlier than 3 seconds ago
			if (self.lastLoadUpHistoryRequest + 3000 > currentMillis) {
				logger.info("Skipping loading message, because it's locked")();
				return
			}
			self.lastLoadUpHistoryRequest = currentMillis;
			var getMessageRequest = {
				headerId: self.headerId,
				count: count,
				action: 'loadMessages',
				channel: self.roomId
			};
			wsHandler.sendToServer(getMessageRequest);
		}
	};
	self.destroy = function () {
		var elements = [self.dom.chatBoxDiv, self.dom.roomNameLi, self.dom.userList];
		for (var i = 0; i < elements.length; i++) {
			CssUtils.deleteElement(elements[i]);
		}
	}
}


function DownloadBar(holder, fileSize, statusDiv) {
	var self = this;
	self.dom = {
		wrapper: holder,
		text: document.createElement('A'),
		statusDiv: statusDiv
	};
	self.max = fileSize;
	self.dom.wrapper.className = 'progress-wrap';
	self.dom.wrapper.appendChild(self.dom.text);
	self.PROGRESS_CLASS = 'animated';
	self.SUCC_CLASS = 'success';
	self.ERR_CLASS = 'error';
	self.setValue = function (value) {
		var percent = Math.round(value * 100 / self.max) + "%";
		self.dom.text.style.width = percent;
		self.dom.text.textContent = percent;
	};
	self.setStatus = function (text) {
		self.dom.statusDiv.textContent = text;
	};
	self.getAnchor = function () {
		return self.dom.text;
	};
	self.show = function () {
		CssUtils.showElement(self.dom.wrapper);
	};
	self.hide = function () {
		CssUtils.hideElement(self.dom.wrapper);
	};
	self.setSuccess = function () {
		CssUtils.setOnOf(self.dom.wrapper, self.SUCC_CLASS, [self.PROGRESS_CLASS, self.ERR_CLASS]);
	};
	self.setError = function () {
		CssUtils.setOnOf(self.dom.wrapper, self.ERR_CLASS, [self.PROGRESS_CLASS, self.SUCC_CLASS]);
	};
	self.start = function () {
		self.dom.text.removeAttribute('href');
		self.dom.text.removeAttribute('download');
		CssUtils.setOnOf(self.dom.wrapper, self.PROGRESS_CLASS, [self.ERR_CLASS, self.SUCC_CLASS]);
		self.setValue(0);
	};
	self.start();
}

function SenderPeerConnection(connectionId, opponentWsId, removeChildPeerReferenceFn) {
	var self = this;
	AbstractPeerConnection.call(self, connectionId, opponentWsId, removeChildPeerReferenceFn);
	self.handleAnswer = function () {
		self.log('answer received')();
	};
	self.createOffer = function () {
		self.log('Creating offer...')();
		self.pc.createOffer(function (offer) {
			self.log('Created offer, setting local description')();
			self.pc.setLocalDescription(offer, function () {
				self.log('Sending offer to remote')();
				self.sendWebRtcEvent(offer);
			}, self.failWebRtc('setLocalDescription'));
		}, self.failWebRtc('createOffer'), self.sdpConstraints);
	};
}

function ReceiverPeerConnection(connectionId, opponentWsId, removeChildPeerReferenceFn) {
	var self = this;
	AbstractPeerConnection.call(self, connectionId, opponentWsId, removeChildPeerReferenceFn);
	self.handleAnswer = function () {
		self.log('Creating answer')();
		self.pc.createAnswer(function (answer) {
			self.log('Sending answer')();
			self.pc.setLocalDescription(answer, function () {
				self.sendWebRtcEvent(answer);
			}, self.failWebRtc('setLocalDescription'));
		}, self.failWebRtc('createAnswer'), self.sdpConstraints);
	};
	self.onChannelMessage = function (msg) {
// 		self.log('Received {} from webrtc data channel', bytesToSize(event.data.byteLength))();
	}
}


function AbstractPeerConnection(connectionId, opponentWsId, removeChildPeerReferenceFn) {
	var self = this;
	self.opponentWsId = opponentWsId;
	self.connectionId = connectionId;
	self.pc = null;
	self.removeChildPeerReference = removeChildPeerReferenceFn;
	var webRtcUrl = isFirefox ? 'stun:23.21.150.121' : 'stun:stun.l.google.com:19302';
	self.pc_config = {iceServers: [{url: webRtcUrl}]};
	self.pc_constraints = {
		optional: [/*Firefox*/
			/*{DtlsSrtpKeyAgreement: true},*/
			{RtpDataChannels: false /*true*/}
		]
	};
	self.log = function () {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(self.connectionId + ":" + self.opponentWsId);
		return logger.webrtc.apply(logger, args);
	};
	self.logErr = function (text) {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(self.connectionId + ":" + self.opponentWsId);
		return logger.webrtcErr.apply(logger, args);
	};
	self.print = function (message) {
		self.log("Call message {}", JSON.stringify(message))();
	};
	self.onsendRtcData = function (message) {
		var data = message.content;
		self.log("onsendRtcData")();
		if (self.pc.iceConnectionState && self.pc.iceConnectionState !== 'closed') {
			if (data.sdp) {
				self.pc.setRemoteDescription(new RTCSessionDescription(data), self.handleAnswer, self.failWebRtc('setRemoteDescription'));
			} else if (data.candidate) {
				self.pc.addIceCandidate(new RTCIceCandidate(data));
			} else if (data.message) {
				growlInfo(data.message);
			}
		} else {
			self.logErr("Skipping ws message for closed connection")();
		}
	};
	self.createPeerConnection = function () {
		self.log("Creating RTCPeerConnection")();
		if (!RTCPeerConnection) {
			throw "Your browser doesn't support RTCPeerConnection";
		}
		self.pc = new RTCPeerConnection(self.pc_config, self.pc_constraints);
		self.pc.oniceconnectionstatechange = self.oniceconnectionstatechange;
		self.pc.onicecandidate = function (event) {
			self.log('onicecandidate');
			if (event.candidate) {
				self.sendWebRtcEvent(event.candidate);
			}
		};
	};
	self.closePeerConnection = function (text) {
		if (self.pc && self.pc.signalingState !== 'closed') {
			self.log("Closing peer connection")();
			self.pc.close();
		} else {
			self.log("No peer connection to close")();
		}
	};

	self.sendWebRtcEvent = function (message) {
		wsHandler.sendToServer({
			content: message,
			action: 'sendRtcData',
			connId: self.connectionId,
			opponentWsId: self.opponentWsId
		});
	};
	self.failWebRtc = function (parent) {
		return function () {
			var message = "An error occurred while {}: {}".format(parent, Utils.extractError(arguments));
			growlError(message);
			self.logErr(message)();
		}
	};
}


function BaseTransferHandler(removeReferenceFn) {
	var self = this;
	self.removeReference = function () {
		removeReferenceFn(self.connectionId);
	};
	self.removeChildPeerReference = function (id) {
		self.log("Removing peer connection {}", id)();
		delete self.peerConnections[id];
	};
	self.peerConnections = {};
	self.handle = function (data) {
		if (data.handler === 'webrtcTransfer') {
			self['on' + data.action](data);
		} else if (self.peerConnections[data.opponentWsId]) {
			self.peerConnections[data.opponentWsId]['on' + data.action](data);
		} else { // this is only supposed to be for destroyPeerConnection
			// when self.pc.iceConnectionState === 'disconnected' fired before destroyCallConnection action came
			self.logErr("Can't execute {} on {}, because such PC doesn't exist. Existing PC:{}",
					data.action, data.opponentWsId, Object.keys(self.peerConnections))();
		}
	};
	self.setConnectionId = function (id) {
		self.connectionId = id;
		self.log("CallHandler initialized")();
	};
	self.closeAllPeerConnections = function (text) {
		var hasConnections = false;
		for (var pc in self.peerConnections) {
			if (!self.peerConnections.hasOwnProperty(pc)) continue;
			self.peerConnections[pc].closeEvents(text);
			hasConnections = true;
		}
		return hasConnections;
	};
	self.log = function () {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(self.connectionId);
		return logger.webrtc.apply(logger, args);
	};
	self.logErr = function (text) {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(self.connectionId);
		return logger.webrtcErr.apply(logger, args);
	};
}


function CallPopup(answerFn, videoAnswerFn, declineFn) {
	var self = this;
	Draggable.call(self, document.createElement('DIV'), "Call");
	self.dom.callSound = $('chatCall');
	self.dom.callSound.addEventListener("ended", function () {
		Utils.checkAndPlay(self.dom.callSound);
	});
	self.init = function () {
		var answerButtons = document.createElement('div');
		self.dom.users = document.createElement('table');
		self.dom.users.className = 'table';
		answerButtons.className = 'answerButtons noSelection';
		answerButtons.appendChild(self.addButton('answerWebRtcCall', 'icon-call-aswer', 'answer-btn', 'Answer', answerFn));
		answerButtons.appendChild(self.addButton('videoAnswerWebRtcCall', 'icon-videocam', 'video-answer-btn', 'With video', videoAnswerFn));
		answerButtons.appendChild(self.addButton('declineWebRtcCall', 'icon-hang-up', 'decline-btn', 'Decline', declineFn));
		self.dom.body.appendChild(self.dom.users);
		self.dom.body.appendChild(answerButtons);
		document.querySelector('body').appendChild(self.dom.container);
		self.fixInputs();
	};
	self.inserRow = function (name, value) {
		var raw = self.dom.users.insertRow();
		var th = document.createElement('th');
		raw.appendChild(th);
		th.textContent = name;
		var valueField = raw.insertCell();
		valueField.textContent = value;
		return th;
	};
	self.addButton = function (name, icon, className, text, onClickFn) {
		var btn = document.createElement('button');
		self.dom[name] = btn;
		btn.className = className;
		btn.onclick = onClickFn;
		var iconCallAnswer = document.createElement('i');
		iconCallAnswer.className = icon;
		var textDiv = document.createElement('div');
		textDiv.textContent = text;
		btn.appendChild(iconCallAnswer);
		btn.appendChild(textDiv);
		return btn;
	};
	self.hide = function () {
		self.dom.callSound.pause();
		self.super.hide();
	};
	self.initAndShow = function (user, channelName) {
		var text = "{} calls".format(channelName);
		self.setHeaderText(text);
		self.inserRow("Initiator: ", user);
		self.show();
		Utils.checkAndPlay(self.dom.callSound);
	};
	self.closeEvents = function () {
		CssUtils.deleteChildren(self.dom.users);
	};
	self.init();
}


function CallHandler(roomId) {
	var self = this;
	BaseTransferHandler.call(self);
	self.acceptedPeers = [];
	self.callTimeoutTime = 60000;
	self.visible = true;
	self.roomId = roomId;
	self.audioProcessors = {};
	self.callPopupTable = {};
	self.setIsReceiver = function (isReceiver) {
		self.accepted = !isReceiver;
	};
	self.dom = {
		callAnswerText: $('callAnswerText'),
		callContainer: $('callContainer'),
		callContainerContent: document.createElement("DIV"),
		videoContainer: document.createElement("DIV"),
		videoContainerForVideos: document.createElement("DIV"),
		local: document.createElement('video'),
		audioStatusIcon: document.createElement('i'),
		videoStatusIcon: document.createElement('i'),
		hangUpIcon: document.createElement('i'),
		hangUpHolder: document.createElement('div'),
		microphoneLevel: document.createElement('progress'),
		callIcon: document.createElement('i'),
		fs: {
			/*FullScreen*/
			video: document.createElement("i"),
			audio: document.createElement("i"),
			hangup: document.createElement("i"),
			minimize: document.createElement("i"),
			enterFullScreen: document.createElement("i")
		}
	};
	self.constraints = {
		audio: true,
		video: true
	};
	self.hidePhoneIcon = function () {
		if (self.dom.phoneIcon) {
			CssUtils.deleteElement(self.dom.phoneIcon);
			delete self.dom.phoneIcon;
		}
	};
	self.showPhoneIcon = function () {
		if (!self.dom.phoneIcon) {
			self.dom.phoneIcon = document.createElement('i');
			self.dom.phoneIcon.className = 'icon-phone';
			var roomNameLi = channelsHandler.channels[self.roomId].dom.roomNameLi;
			roomNameLi.insertBefore(self.dom.phoneIcon, roomNameLi.firstChild);
		}
	};
	self.isActive = function () {
		return self.localStream && self.localStream.active;
	};
	self.setIconState = function (isCall) {
		if (isCall) {
			self.showPhoneIcon()
		} else {
			self.hidePhoneIcon();
		}
		self.callInProggress = isCall;
		CssUtils.setVisibility(self.dom.hangUpHolder, isCall);
		CssUtils.setVisibility(self.dom.videoContainer, isCall);
		CssUtils.setVisibility(self.dom.callIcon, !isCall);
	};
	self.setAudio = function (value) {
		self.constraints.audio = value;
		self.dom.audioStatusIcon.className = value ? "icon-mic" : "icon-mute callActiveIcon";
		self.dom.fs.audio.className = value ? "icon-webrtc-mic" : "icon-webrtc-nomic";
		var title = value ? "Turn off your microphone" : "Turn on your microphone";
		self.dom.audioStatusIcon.title = title;
		self.dom.fs.audio.title = title;
	};
	self.setVideo = function (value) {
		self.constraints.video = value;
		self.dom.videoStatusIcon.className = value ? "icon-videocam" : "icon-no-videocam callActiveIcon";
		self.dom.fs.video.className = value ? "icon-webrtc-video" : "icon-webrtc-novideo";
		CssUtils.setVisibility(self.dom.local, value);
		var title = value ? "Turn off your webcam" : "Turn on your webcam";
		self.dom.videoStatusIcon.title = title;
		self.dom.fs.video.title = title;
	};
	self.attachDomEvents = function () {
		self.dom.videoStatusIcon.onclick = self.toggleVideo;
		self.dom.fs.video.onclick = self.toggleVideo;
		self.dom.hangUpIcon.onclick = self.hangUp;
		self.dom.fs.hangup.onclick = self.hangUp;
		self.dom.fs.audio.onclick = self.toggleMic;
		self.dom.audioStatusIcon.onclick = self.toggleMic;
		var fullScreenChangeEvents = ['webkitfullscreenchange', 'mozfullscreenchange', 'fullscreenchange', 'MSFullscreenChange'];
		for (var i = 0; i < fullScreenChangeEvents.length; i++) {
			document.addEventListener(fullScreenChangeEvents[i], self.onExitFullScreen, false);
		}
		var elem = self.dom.videoContainer;
		if (elem.requestFullscreen) {
			//nothing
		} else if (elem.msRequestFullscreen) {
			elem.requestFullscreen = elem.msRequestFullscreen;
			document.cancelFullScreen = document.msCancelFullScreen;
		} else if (elem.mozRequestFullScreen) {
			elem.requestFullscreen = elem.mozRequestFullScreen;
			document.cancelFullScreen = document.mozCancelFullScreen;
		} else if (elem.webkitRequestFullscreen) {
			elem.requestFullscreen = elem.webkitRequestFullscreen;
			document.cancelFullScreen = document.webkitCancelFullScreen;
		} else {
			growlError("Can't enter fullscreen");
		}
		elem.ondblclick = self.enterFullScreenMode;
		self.dom.fs.enterFullScreen.onclick = self.enterFullScreenMode;
		self.dom.fs.minimize.onclick = self.exitFullScreen;
		self.dom.fs.hangup.title = 'Hang up';
		self.dom.hangUpIcon.title = self.dom.fs.hangup.title;
		self.idleTime = 0;
	};
	self.answerWebRtcCall = function () {
		self.setAudio(true);
		self.setVideo(false);
		self.accept();
		self.setHeaderText("Answered for {} call with audio".format(self.receiverName));
	};
	self.videoAnswerWebRtcCall = function () {
		self.accept();
		self.setAudio(true);
		self.setVideo(true);
		self.setHeaderText("Answered for {} call with video".format(self.receiverName));
	};
	self.getCallPopup = function () {
		if (!self.callPopup) {
			self.callPopup = new CallPopup(self.answerWebRtcCall, self.videoAnswerWebRtcCall, self.hangUp);
		}
		return self.callPopup;
	};
	self.renderDom = function () {
		var iwc = document.createElement('DIV');
		self.dom.videoContainerForVideos.appendChild(self.dom.local);
		self.dom.local.setAttribute('muted', true);
		self.dom.local.className = 'localVideo';
		self.dom.videoContainer.appendChild(iwc);
		self.dom.videoContainer.appendChild(self.dom.videoContainerForVideos);
		self.dom.videoContainer.className = 'videoContainer ' + CssUtils.visibilityClass;
		self.dom.callContainerContent.className = 'callContainerContent';
		self.dom.callContainerContent.appendChild(self.dom.videoContainer);
		self.dom.callContainer.appendChild(self.dom.callContainerContent);
		self.dom.fs.minimize.className = 'icon-webrtc-minimizedscreen';
		self.dom.fs.minimize.title = 'Exit fullscreen';
		self.dom.fs.hangup.className = 'icon-webrtc-hangup';
		iwc.className = 'icon-webrtc-cont';
		iwc.appendChild(self.dom.fs.video);
		iwc.appendChild(self.dom.fs.audio);
		iwc.appendChild(self.dom.fs.minimize);
		iwc.appendChild(self.dom.fs.hangup);
		var callContainerIcons = document.createElement('div');
		callContainerIcons.className = 'callContainerIcons noSelection';
		self.dom.callContainerContent.appendChild(callContainerIcons);
		self.dom.callIcon.onclick = self.offerCall;
		self.dom.callIcon.className = 'icon-phone-circled';
		self.dom.audioStatusIcon.className = 'icon-mic';
		self.dom.videoStatusIcon.className = 'icon-videocam';

		var enterFullScreenHolder = document.createElement('div');
		enterFullScreenHolder.className = 'enterFullScreenHolder';
		self.dom.fs.enterFullScreen.className = 'icon-webrtc-fullscreen';
		self.dom.fs.enterFullScreen.title = 'Fullscreen';
		enterFullScreenHolder.appendChild(self.dom.fs.enterFullScreen);

		self.dom.hangUpHolder.className = 'hangUpHolder ' + CssUtils.visibilityClass;
		self.dom.hangUpHolder.appendChild(self.dom.hangUpIcon);
		self.dom.hangUpIcon.className = 'icon-hang-up ';
		self.dom.hangUpIcon.title = 'Hang Up';
		self.dom.microphoneLevel.setAttribute("max", "160");
		self.dom.microphoneLevel.setAttribute("value", "0");
		self.dom.microphoneLevel.setAttribute("title", "Your microphone level");
		self.dom.microphoneLevel.className = 'microphoneLevel';
		callContainerIcons.appendChild(self.dom.callIcon);
		callContainerIcons.appendChild(self.dom.audioStatusIcon);
		callContainerIcons.appendChild(self.dom.videoStatusIcon);
		callContainerIcons.appendChild(enterFullScreenHolder);
		callContainerIcons.appendChild(self.dom.hangUpHolder);
		callContainerIcons.appendChild(self.dom.microphoneLevel);
	};
	self.init = function () {
		self.renderDom();
		self.attachDomEvents();
	};
	self.captureInput = function (callback, callIfNoSource) {
		if (self.constraints.audio || self.constraints.video) {
			navigator.getUserMedia(self.constraints, callback, self.onFailedCaptureSource);
		} else if (callIfNoSource) {
			callback();
		}
	};
	self.attachLocalStream = function (stream) {
		self.localStream = stream;
		if (stream) {
			Utils.setVideoSource(self.dom.local, stream);
		}
		self.setVideo(self.getTrack(true) != null);
		self.setAudio(self.getTrack(false) != null);
		self.audioProcessor = Utils.createMicrophoneLevelVoice(stream, self.processAudio);
	};
	self.processAudio = function (audioProc) {
		return function () {
			if (!self.constraints.audio) {
				return;
			}
			var value = Utils.getAverageAudioLevel(audioProc);
			audioProc.prevVolumeValues += value;
			audioProc.volumeValuesCount++;
			if (audioProc.volumeValuesCount == 100 && audioProc.prevVolumeValues == 0) {
				self.showNoMicError();
			}
			self.dom.microphoneLevel.value = value;
		}
	};
	self.captureInputStream = function (stream) {
		self.setIconState(true);
		self.setHeaderText("Establishing connection with {}".format(self.receiverName));
		self.attachLocalStream(stream);
		var id = webRtcApi.addCallHandler(self);
		self.sendOffer(id);
		self.setTimeout();
	};
	self.onFailedCaptureSource = function () {
		var what = '';
		if (self.constraints.audio && self.constraints.audio) {
			what = 'audio and video'
		} else if (self.constraints.audio) {
			what = 'audio'
		} else {
			what = 'video'
		}
		var message = "Failed to capture {} source, because {}".format(what, Utils.extractError(arguments));
		growlError(message);
		self.logErr(message);
	};
	self.setHeaderText = function (text) { // TODO multirtc
		channelsHandler.setTitle(text);
		singlePage.updateTitle();
	};
	self.offerCall = function () {
		self.accepted = true;
		self.setHeaderText("Confirm browser to use your input devices for call");
		self.captureInput(self.captureInputStream);
	};
	self.show = function () {
		self.visible = true;
		CssUtils.showElement(self.dom.callContainerContent);
	};
	self.hide = function () {
		CssUtils.hideElement(self.dom.callContainerContent);
	};
	self.toggle = function () {
		self.visible = !CssUtils.toggleVisibility(self.dom.callContainerContent);
	};
	self.restoreState = function () {
		CssUtils.setVisibility(self.dom.callContainerContent, self.visible);
	};
	self.showOffer = function (message, channelName) {
		self.getCallPopup().initAndShow(message.user, channelName);
		notifier.notify(message.user, "Calls you");
	};
	self.showNoMicError = function () {
		var url = isChrome ? 'setting in chrome://settings/content' : 'your browser settings';
		url += navigator.platform.indexOf('Linux') >= 0 ?
				'. Open pavucontrol for more info' :
				' . Right click on volume icon in system tray -> record devices -> input -> microphone';
		growlError('<div>Unable to capture input from microphone. Check your microphone connection or {}'
				.format(url));
	};
	self.createCallAfterCapture = function (stream) {
		self.attachLocalStream(stream);
		self.sendAcceptAndInitPeerConnections();
	};
	self.createAfterResponseCall = function () {
		self.captureInput(self.createCallAfterCapture, true);
		self.setIconState(true);
		channelsHandler.setActiveChannel(self.roomId);
		self.show(true);
	};
	self.getTrack = function (isVideo) {
		var track = null;
		if (self.localStream) {
			var tracks = isVideo ? self.localStream.getVideoTracks() : self.localStream.getAudioTracks();
			if (tracks.length > 0) {
				track = tracks[0]
			}
		}
		return track;
	};
	self.toggleInput = function (isVideo) {
		var kind = isVideo ? 'video' : 'audio';
		var track = self.getTrack(isVideo);
		if (!self.isActive() || track) {
			var newValue = !self.constraints[kind];
			if (isVideo) {
				self.setVideo(newValue);
			} else {
				self.setAudio(newValue);
			}
		}
		if (track) {
			track.enabled = self.constraints[kind];
		} else if (self.isActive()) {
			growlError("You need to call/reply with {} to turn it on".format(kind));
		}
	};
	self.toggleVideo = function () {
		self.toggleInput(true);
	};
	self.toggleMic = function () {
		self.toggleInput(false);
	};
	self.createCallPeerConnection = function (message) {
		var videoContainer = document.createElement('div');
		videoContainer.className = 'micVideoWrapper';
		self.dom.videoContainerForVideos.insertBefore(videoContainer, self.dom.videoContainerForVideos.firstChild);
		var PeerConnectionClass = message.opponentWsId > wsHandler.wsConnectionFullId ? CallSenderPeerConnection : CallReceiverPeerConnection;
		self.peerConnections[message.opponentWsId] = new PeerConnectionClass(
				message.connId,
				message.opponentWsId,
				self.removeChildPeerReference,
				videoContainer,
				self.onStreamAttached,
				message.user
		);
	};
	self.superRemoveChildPeerReference = self.removeChildPeerReference;
	self.removeChildPeerReference = function (id, reason) {
		self.superRemoveChildPeerReference(id);
		var index = self.acceptedPeers.indexOf(id);
		if (index > -1) { // remove
			self.acceptedPeers.splice(index, 1);
			self.log("Removed {} from acceptedPeers, current acceptedPeers are {}", id, self.acceptedPeers.toString())();
		}
		if (!self.accepted) {
			if (self.callPopupTable[id]) {
				self.callPopupTable[id].textContent = 'Declined';
			}
		}
		if (Object.keys(self.peerConnections).length === 0) {
			self.log("All peer connections are gone, destroying CallHandler")();
			self.closeEvents(reason);
		}
	};
	self.onStreamAttached = function (opponentWsId) { // TODO this is called multiple times for each peer connection
		self.setHeaderText("Talking with <b>{}</b>".format(self.receiverName));
		self.setIconState(true);
	};
	self.onreplyCall = function (message) {
		self.createCallPeerConnection(message);
		if (self.callPopup) { // if we're not call initiator
			self.callPopupTable[message.opponentWsId] = self.callPopup.inserRow("Called:", message.user);
		}
	};
	self.oncancelCallConnection = function (message) {
		if (self.callPopup) { // if we're not call initiator
			self.callPopupTable[message.opponentWsId] = self.callPopup.inserRow("Busy:", message.user);
		}
	};
	self.sendOffer = function (newId) {
		var messageRequest = {
			action: 'offerCall',
			channel: self.roomId,
			id: newId
		};
		wsHandler.sendToServer(messageRequest);
	};
	self.accept = function () {
		self.clearTimeout();
		self.callPopup.hide();
		self.createAfterResponseCall();
	};
	self.sendAcceptAndInitPeerConnections = function () {
		self.accepted = true;
		self.acceptedPeers.forEach(function (e) {
			if (self.peerConnections[e]) {
				self.peerConnections[e].connectToRemote(self.localStream);
			} else {
				self.logErr("Unable to get pc with id {}, available peer connections are {}, accepted peers are {}",
						e, Object.keys(self.peerConnections), self.acceptedPeers.toString())();
			}
		});
		wsHandler.sendToServer({
			action: 'acceptCall',
			connId: self.connectionId
		});
	};
	self.setTimeout = function () {
		self.timeoutFunnction = setTimeout(function () {
			self.log("Closing CallHandler by timeout")();
			self.hangUp();
		}, self.callTimeoutTime);
	};
	self.clearTimeout = function () {
		if (self.timeoutFunnction) {
			clearTimeout(self.timeoutFunnction);
			self.timeoutFunnction = null;
		}
	};
	self.initAndDisplayOffer = function (message, channelName) {
		self.callInProggress = true;
		self.setTimeout();
		self.connectionId = message.connId;
		self.log("CallHandler initialized")();
		wsHandler.sendToServer({
			action: 'replyCall',
			connId: message.connId
		});
		self.acceptedPeers.push(message.opponentWsId);
		self.createCallPeerConnection(message);
		self.showOffer(message, channelName);
	};
	self.onacceptCall = function (message) {
		if (self.accepted) {
			self.clearTimeout(); // if we're call initiator
			self.peerConnections[message.opponentWsId].connectToRemote(self.localStream);
		} else {
			self.callPopupTable[message.opponentWsId].textContent = 'Talking:';
			self.acceptedPeers.push(message.opponentWsId);
		}
	};
	self.hangUp = function () {
		self.clearTimeout();
		var wereConn = self.closeAllPeerConnections("Call is finished.");
		if (!wereConn) { // last peerConnection will call self.closeEvents
			// if there were no any - we call it manually
			self.closeEvents("Call is finished.")
		}
		self.decline();
	};
	self.closeEvents = function (text) {
		if (text) {
			growlInfo(text)
		}
		if (self.callPopup) {
			self.callPopup.closeEvents();
			self.callPopup.hide();
		}
		// if somebody sent us destroyConnection event, b4 timeout fired
		self.clearTimeout();
		self.accepted = false;
		self.setHeaderText(loggedUser);
		self.setIconState(false);
		self.callPopupTable = {};
		webRtcApi.removeChildReference(self.connectionId);
		self.dom.microphoneLevel.value = 0;
		self.exitFullScreen();
		self.dom.local.pause();
		self.dom.local.src = null;
		if (self.localStream) {
			var tracks = self.localStream.getTracks();
			for (var i = 0; i < tracks.length; i++) {
				tracks[i].stop()
			}
		}
	};
	self.onExitFullScreen = function () {
		if (!(document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement)) {
			CssUtils.removeClass(self.dom.videoContainer, 'fullscreen');
			document.removeEventListener('mousemove', self.fsMouseMove, false);
			clearInterval(self.hideContainerTimeoutRes);
			self.dom.videoContainer.ondblclick = self.enterFullScreenMode;
		}
	};
	self.exitFullScreen = function () {
		document.cancelFullScreen();
	};
	self.hideContainerTimeout = function () {
		self.idleTime++;
		if (self.idleTime > 6) {
			CssUtils.addClass(self.dom.videoContainer, 'inactive');
		}
	};
	self.enterFullScreenMode = function () {
		self.dom.videoContainer.removeEventListener('dblclick', self.enterFullScreenMode);
		self.dom.videoContainer.requestFullscreen();
		CssUtils.addClass(self.dom.videoContainer, 'fullscreen');
		document.addEventListener('mousemove', self.fsMouseMove, false);
		self.hideContainerTimeoutRes = setInterval(self.hideContainerTimeout, 1000);
		/*to clear only function from resultOf setInterval should be passed, otherwise doesn't work*/
	};
	self.fsMouseMove = function () {
		if (self.idleTime > 0) {
			CssUtils.removeClass(self.dom.videoContainer, 'inactive');
		}
		self.idleTime = 0;
	};
	self.decline = function () {
		wsHandler.sendToServer({
			content: 'decline',
			action: 'destroyCallConnection',
			connId: self.connectionId
		});
	};
	self.init();
}

function FileTransferHandler(removeReferenceFn) {
	var self = this;
	BaseTransferHandler.call(self, removeReferenceFn);
	Draggable.call(self, document.createElement('DIV'), "File transfer");
	self.closeWindowClick = function () {
		self.decline();
		self.closeAllPeerConnections();
		self.removeReference();
	};
	self.dom.fileInfo = document.createElement('table');
	self.init = function () {
		self.dom.fileInfo.className = 'table';
		document.querySelector('body').appendChild(self.dom.container);
		CssUtils.addClass(self.dom.body, 'transferFile');
		self.dom.iconCancel.onclick = self.noAction;
		self.insertData('Name:', self.fileName);
		self.insertData('Size:', bytesToSize(self.fileSize));
		self.dom.body.appendChild(self.dom.fileInfo);
	};
	self.insertData = function (name, value) {
		var raw = self.dom.fileInfo.insertRow();
		var th = document.createElement('th');
		raw.appendChild(th);
		th.textContent = name;
		var valueField = raw.insertCell();
		valueField.textContent = value;
		return valueField;
	};
	self.noAction = function () {
		self.closeWindowClick();
		self.destroy();
	};
	self.decline = function () {
		wsHandler.sendToServer({
			content: 'decline',
			action: 'destroyFileConnection',
			connId: self.connectionId
		});
	};
}


function FileReceiver(removeReferenceFn) {
	var self = this;
	FileTransferHandler.call(self, removeReferenceFn);
	self.showOffer = function (message) {
		self.fileSize = parseInt(message.content.size);
		self.fileName = message.content.name;
		self.opponentName = message.user;
		notifier.notify(message.user, "Sends file {}".format(self.fileName));
		self.init();
		self.insertData("From:", self.opponentName);
		self.setHeaderText("{} sends {}".format(self.opponentName, self.fileName));
		self.dom.connectionStatus = self.insertData('Status:', 'Received an offer');
		self.addYesNo();
	};
	self.yesAction = function () {
		self.hideButtons();
		self.acceptFileReply();
	};
	self.hideButtons = function () {
		if (self.dom.yesNoHolder) {
			CssUtils.hideElement(self.dom.yesNoHolder)
		}
	};
	self.addYesNo = function () {
		self.dom.yesNoHolder = document.createElement('DIV');
		self.dom.yes = document.createElement('INPUT');
		self.dom.no = document.createElement('INPUT');
		self.dom.body.appendChild(self.dom.yesNoHolder);
		self.dom.yesNoHolder.appendChild(self.dom.yes);
		self.dom.yesNoHolder.appendChild(self.dom.no);
		self.dom.yesNoHolder.className = 'yesNo';
		self.dom.yes.onclick = self.yesAction;
		self.dom.no.onclick = self.noAction;
		self.dom.yes.setAttribute('type', 'button');
		self.dom.no.setAttribute('type', 'button');
		self.dom.yes.setAttribute('value', 'Accept');
		self.dom.no.setAttribute('value', 'Decline');
		self.fixInputs();
	};
	self.sendErrorFSApi = function () {
		var bsize = bytesToSize(MAX_ACCEPT_FILE_SIZE_WO_FS_API);
		wsHandler.sendToServer({
			action: 'destroyFileConnection',
			connId: self.connectionId,
			content: "User's browser doesn't support accepting files over {}"
					.format(bsize)
		});
	};
	self.acceptFileReply = function () {
		if (self.fileSize > MAX_ACCEPT_FILE_SIZE_WO_FS_API && !requestFileSystem) {
			self.sendErrorFSApi();
			growlError("Your browser doesn't support receiving files over {}".format(bsize))
		} else {
			self.peerConnections[self.offerOpponentWsId] = new FileReceiverPeerConnection(
					self.connectionId,
					self.offerOpponentWsId,
					self.fileName,
					self.fileSize,
					self.removeChildPeerReference
			);
			var db = self.addDownloadBar();
			self.peerConnections[self.offerOpponentWsId].initFileSystemApi(self.sendAccessFileSuccess);
			self.peerConnections[self.offerOpponentWsId].setDownloadBar(db);
		}
	};
	self.sendAccessFileSuccess = function (fileSystemSucess) {
		if (fileSystemSucess) {
			self.peerConnections[self.offerOpponentWsId].waitForAnswer();
			wsHandler.sendToServer({
				action: 'acceptFile',
				connId: self.connectionId
			});
		} else if (self.fileSize > MAX_ACCEPT_FILE_SIZE_WO_FS_API) {
			self.sendErrorFSApi();
			self.peerConnections[self.offerOpponentWsId].destroy(); //TODO
		}
	};
	self.ondestroyFileConnection = function (message) {
		if (self.peerConnections[message.opponentWsId]) {
			self.peerConnections[message.opponentWsId].ondestroyFileConnection(message);
		} else {
			self.hideButtons();
			self.dom.connectionStatus.textContent = "Opponent declined sending";
		}
	};
	self.addDownloadBar = function () {
		var div = document.createElement("DIV");
		self.dom.body.appendChild(div);
		return new DownloadBar(div, self.fileSize, self.dom.connectionStatus);
	};
	self.initAndDisplayOffer = function (message) {
		self.connectionId = message.connId;
		self.log("initAndDisplayOffer file")();
		self.offerOpponentWsId = message.opponentWsId;
		wsHandler.sendToServer({
			action: 'replyFile',
			connId: message.connId
		});
		self.showOffer(message);
	};
}

function FileSender(removeReferenceFn, file) {
	var self = this;
	self.file = file;
	FileTransferHandler.call(self, removeReferenceFn);
	self.sendOffer = function (quedId, currentActiveChannel) {
		//self.dom.fileInput.disabled = true;
		self.fileName = self.file.name;
		self.fileSize = self.file.size;
		self.setHeaderText("Sending {}".format(self.fileName));
		var messageRequest = {
			action: 'offerFile',
			channel: currentActiveChannel,
			id: quedId,
			content: {
				name: self.fileName,
				size: self.fileSize
			}
		};
		wsHandler.sendToServer(messageRequest);
		self.init();
	};
	self.onreplyFile = function (message) {
		self.peerConnections[message.opponentWsId] = new FileSenderPeerConnection(message.connId, message.opponentWsId, self.file, self.removeChildPeerReference);
		var downloadBar = self.addDownloadBar(message.user);
		self.peerConnections[message.opponentWsId].setDownloadBar(downloadBar);
	};
	self.ondestroyFileConnection = function (message) {
		self.peerConnections[message.opponentWsId].ondestroyFileConnection(message);
	};
	self.addDownloadBar = function (senderName) {
		var div = document.createElement("DIV");
		var status = self.insertData('To {}:'.format(senderName), 'Waiting to accept');
		var raw = self.dom.fileInfo.insertRow();
		var valueField = raw.insertCell();
		valueField.setAttribute('colspan', 2);
		valueField.appendChild(div);
		return new DownloadBar(div, self.fileSize, status);
	};
}


function FilePeerConnection() {
	var self = this;
	self.CHUNK_SIZE = 16384;
	self.MAX_BUFFER_SIZE = 256;
	self.receivedSize = 0;
	self.sdpConstraints = {};
	self.oniceconnectionstatechange = function () {
		if (self.pc.iceConnectionState === 'disconnected') {
			self.closeEvents();
			self.downloadBar.setStatus("Error: Connection has been lost")
		}
	};
	self.setDownloadBar = function (db) {
		self.downloadBar = db;
	};
	self.ondestroyFileConnection = function () {
		self.removeChildPeerReference(self.opponentWsId);
		self.closeEvents();
	};
	self.onsetError = function (message) {
		if (self.downloadBar) {
			self.downloadBar.setStatus(message.content);
			self.downloadBar.setError();
		} else {
			self.log("Setting status to '{}' failed", message.content)();
		}
	};
	self.setTranseferdAmount = function (value) {
		self.downloadBar.setValue(value);
	};
	self.closeEvents = function () {
		self.closePeerConnection();
		if (self.sendChannel && self.sendChannel.readyState !== 'closed') {
			self.log("Closing chanel")();
			self.sendChannel.close();
		} else {
			self.log("No channels to close")();
		}
	}
}

function FileReceiverPeerConnection(connectionId, opponentWsId, fileName, fileSize, removeChildPeerReferenceFn) {
	var self = this;
	self.fileSize = fileSize;
	self.fileName = fileName;
	self.blobsQueue = [];
	self.recevedUsingFile = false;
	self.receiveBuffer = [];
	FilePeerConnection.call(self);
	ReceiverPeerConnection.call(self, connectionId, opponentWsId, removeChildPeerReferenceFn);
	self.log("Created FileReceiverPeerConnection")();
	self.superGotReceiveChannel = self.gotReceiveChannel;
	self.gotReceiveChannel = function (event) {
		self.superGotReceiveChannel(event);
	};
	self.superOnDestroyFileConnection = self.ondestroyFileConnection;
	self.ondestroyFileConnection = function (data) {
		self.superOnDestroyFileConnection(data);
		self.downloadBar.setStatus("Error: Opponent closed connection");
		self.downloadBar.setError();
	};
	self.assembleFileIfDone = function () {
		if (self.isDone()) {
			var received = self.recevedUsingFile ? self.fileEntry.toURL() : URL.createObjectURL(new window.Blob(self.receiveBuffer));
			self.log("File is received")();
			wsHandler.sendToServer({
				content: 'success',
				action: 'destroyFileConnection',
				connId: self.connectionId,
				opponentWsId: self.opponentWsId
			});
			self.receiveBuffer = []; //clear buffer
			self.receivedSize = 0;
			self.downloadBar.getAnchor().href = received;
			self.downloadBar.getAnchor().download = self.fileName;
			self.downloadBar.setStatus("Received");
			self.downloadBar.setSuccess();
			self.downloadBar.getAnchor().textContent = 'Save';
			self.closeEvents();
		}
	};
	self.isDone = function () {
		return self.receivedSize === self.fileSize;
	};
	self.initFileSystemApi = function (cb) {
		self.log("Creating temp location {}", bytesToSize(self.fileSize))();
		if (requestFileSystem) {
			requestFileSystem(window.TEMPORARY, self.fileSize, function (fs) {
				fs.root.getFile(self.connectionId, {create: true}, function (fileEntry) {
					self.fileEntry = fileEntry;
					self.fileEntry.createWriter(function (fileWriter) {
						self.fileWriter = fileWriter;
						self.fileWriter.WRITING = 1;
						self.fileWriter.onwriteend = self.onWriteEnd;
						self.log("FileWriter is created")();
						cb(true);
					}, self.fileSystemErr(1, cb));

				}, self.fileSystemErr(2, cb))
			}, self.fileSystemErr(3, cb));
		} else {
			cb(false);
		}
	};
	self.fileSystemErr = function (errN, cb) {
		return function (e) {
			growlError("FileSystemApi Error: " + e.message || e.code || e);
			self.logErr("FileSystemApi Error {}, {}", errN, e.message || e.code || e)();
			cb(false);
		};

	};
	self.channelOpen = function () {
		self.downloadBar.setStatus("Receiving file...");
	};
	self.superOnChannelMessage = self.onChannelMessage;
	self.onChannelMessage = function (event) {
		self.superOnChannelMessage(event);
		self.receiveBuffer.push(event.data);
		self.receivedSize += event.data.byteLength;
		self.syncBufferWithFs();
		self.setTranseferdAmount(self.receivedSize);
		self.assembleFileIfDone();
	};
	self.onWriteEnd = function () {
		if (self.blobsQueue.length > 0) {
			self.fileWriter.write(self.blobsQueue.shift());
		} else {
			self.assembleFileIfDone();
		}
	};
	self.syncBufferWithFs = function () {
		if (self.fileWriter && (self.receiveBuffer.length > self.MAX_BUFFER_SIZE || self.isDone())) {
			self.recevedUsingFile = true;
			var blob = new window.Blob(self.receiveBuffer);
			self.receiveBuffer = [];
			if (self.fileWriter.readyState == self.fileWriter.WRITING) {
				self.blobsQueue.push(blob);
			} else {
				self.fileWriter.write(blob);
			}
		}
	};
	self.waitForAnswer = function () {
		self.createPeerConnection();
		self.log("Waiting for rtc datachannels.")();
		self.pc.ondatachannel = self.gotReceiveChannel;
		self.downloadBar.setStatus("Establishing connection");
	};
	self.gotReceiveChannel = function (event) {
		self.log('Received new channel')();
		self.sendChannel = event.channel;
		self.sendChannel.onmessage = self.onChannelMessage;
		self.sendChannel.onopen = self.channelOpen;
		//self.sendChannel.onclose = self.print;
	};
}

function FileSenderPeerConnection(connectionId, opponentWsId, file, removeChildPeerReferenceFn) {
	var self = this;
	FilePeerConnection.call(self);
	self.file = file;
	self.fileName = file.name;
	self.fileSize = file.size;
	SenderPeerConnection.call(self, connectionId, opponentWsId, removeChildPeerReferenceFn);
	self.sendChannel = null;
	self.log("Created FileSenderPeerConnection")();
	self.onfileAccepted = function (message) {
		self.log("Transfer file {} result : {}", self.fileName, message.content)();
		self.downloadBar.setStatus("Transferred");
		self.downloadBar.setSuccess();
		self.closeEvents();
	};
	self.superOnDestroyFileConnection = self.ondestroyFileConnection;
	self.ondestroyFileConnection = function (data) {
		self.superOnDestroyFileConnection();
		if (data.content === 'success') {
			self.downloadBar.setStatus("File transferred");
			self.downloadBar.setSuccess();

		} else {
			self.downloadBar.setStatus(data.content === 'decline' ?
					"Declined by opponent" : "Connection error");
			self.downloadBar.setError();
		}
	};
	self.createSendChannelAndOffer = function () {
		try {
			// Reliable data channels not supported by Chrome
			self.sendChannel = self.pc.createDataChannel("sendDataChannel", {reliable: false});
			self.sendChannel.onopen = self.onreceiveChannelOpen;
			self.log("Created send data channel.")();
		} catch (e) {
			var error = "Failed to create data channel because {} ".format(e.message || e);
			growlError(error);
			self.logErr(error)();
		}
		self.createOffer();
	};
	self.onreceiveChannelOpen = function () {
		self.log('Channel is open, slicing file: {} {} {} {}', self.fileName, bytesToSize(self.fileSize), self.file.type, getDay(self.file.lastModifiedDate))();
		if (self.fileSize === 0) {
			self.downloadBar.setStatus("Can't send empty file");
			self.downloadBar.setError();
			self.closeEvents("Can't send empty file");
		} else {
			self.downloadBar.setStatus("Sending file...");
			self.reader = new window.FileReader();
			self.offset = 0;
			self.reader.onload = self.onFileReaderLoad;
			self.sendCurrentSlice();
			self.lastPrinted = 0;
		}
	};
	self.sendCurrentSlice = function () {
		var currentSlice = self.file.slice(self.offset, self.offset + self.CHUNK_SIZE);
		self.reader.readAsArrayBuffer(currentSlice);
	};
	self.logTransferProgress = function () {
		var now = Date.now();
		if (now - self.lastPrinted > 1000) {
			self.lastPrinted = now;
			return self.log.apply(self, arguments);
		} else {
			return function () {
			};
		}
	};
	self.onFileReaderLoad = function (e) {
		try {
			if (self.sendChannel.readyState === 'open') {
				if (self.sendChannel.bufferedAmount > 10000000) { // prevent chrome buffer overfill
					// if it happens chrome will just close the datachannel
					self.logTransferProgress("Buffer overflow by {}bytes, waiting to flush...",
							bytesToSize(self.sendChannel.bufferedAmount))();
					return window.setTimeout(self.onFileReaderLoad, 100, {target: {result: e.target.result}});
				}
				self.sendChannel.send(e.target.result);
				var readSize = e.target.result.byteLength;
				if (self.fileSize >= self.offset + readSize) {
					window.setTimeout(self.sendCurrentSlice, 0);
				} else {
					self.log("Exiting, offset is {} now, fs: {}", self.offset, self.fileSize)();
				}
				self.setTranseferdAmount(self.offset + readSize);
				self.offset += self.CHUNK_SIZE;
				self.logTransferProgress("Transferred {}/{}", bytesToSize(self.offset), bytesToSize(self.fileSize))();
			} else {
				throw 'sendChannel status is {} which is not equals to "open"'.format(self.sendChannel.readyState);
			}
		} catch (error) {
			self.downloadBar.setStatus("Error: Connection has been lost");
			self.downloadBar.setError();
			self.closeEvents("SendChannel is in status {} which is not opened".format(self.sendChannel.readyState));
			self.logErr(error)();
			growlError("Connection loss while sending file {} to user {}".format(self.fileName, self.receiverName));
		}
	};
	self.channelOpen = function () {
		self.downloadBar.setStatus("Sending a file");
	};
	self.onacceptFile = function (message) {
		self.createPeerConnection();
		self.createSendChannelAndOffer();
	};
}


function CallSenderPeerConnection(connectionId,
											 wsOpponentId,
											 removeFromParentFn,
											 remoteVideo,
											 onStreamAttached,
											 userName) {
	var self = this;
	SenderPeerConnection.call(self, connectionId, wsOpponentId, removeFromParentFn);
	CallPeerConnection.call(self, remoteVideo, userName, onStreamAttached);
	self.log("Created CallSenderPeerConnection")();
	self.connectToRemote = function (stream) {
		self.createPeerConnection(stream);
		self.createOffer();
	}
}


function CallReceiverPeerConnection(connectionId,
												wsOpponentId,
												removeFromParentFn,
												videoContainer,
												onStreamAttached,
												userName) {
	var self = this;
	ReceiverPeerConnection.call(self, connectionId, wsOpponentId, removeFromParentFn);
	CallPeerConnection.call(self, videoContainer, userName, onStreamAttached);
	self.log("Created CallReceiverPeerConnection")();
	self.connectToRemote = function (stream) {
		self.createPeerConnection(stream);
	}
}

function CallPeerConnection(videoContainer, userName, onStreamAttached) {
	var self = this;
	self.dom = {
		userSpan: document.createElement('span'),
		videoContainer: videoContainer,
		remote: document.createElement('video'),
		callVolume: document.createElement('input')
	};
	self.init = function () {
		self.dom.userSpan.textContent = userName;
		self.dom.videoContainer.appendChild(self.dom.remote);
		self.dom.callVolume.addEventListener('input', self.changeVolume);
		var colVolumeWrapper = document.createElement('div');
		self.dom.videoContainer.appendChild(colVolumeWrapper);
		colVolumeWrapper.appendChild(self.dom.callVolume);
		self.dom.videoContainer.appendChild(self.dom.userSpan);
		self.dom.callVolume.setAttribute("type", "range");
		self.dom.callVolume.setAttribute("value", "100");
		self.dom.callVolume.setAttribute("title", "Volume level");
		styleInputRange(self.dom.callVolume);
	};
	self.onsetError = function (message) {
		growlError(message.content)
	};
	self.changeVolume = function () {
		self.dom.remote.volume = self.dom.callVolume.value / 100;
	};
	self.sdpConstraints = {
		'mandatory': {
			'OfferToReceiveAudio': true,
			'OfferToReceiveVideo': true
		}
	};
	self.channelOpen = function () {
		self.log('Opened a new chanel')();
	};
	self.oniceconnectionstatechange = function () {
		if (self.pc.iceConnectionState === 'disconnected') {
			self.closeEvents('Connection has been lost');
		}
	};
	self.createPeerConnectionParent = self.createPeerConnection;
	self.createPeerConnection = function (stream) {
		self.createPeerConnectionParent();
		self.pc.onaddstream = function (event) {
			self.log("onaddstream")();
			Utils.setVideoSource(self.dom.remote, event.stream);
			self.audioProcessor = Utils.createMicrophoneLevelVoice(event.stream, self.processAudio);
			onStreamAttached(self.opponentWsId);
		};
		self.pc.addStream(stream);
	};
	self.processAudio = function (audioProc) {
		return function () {
			var level = Utils.getAverageAudioLevel(audioProc); //256 max
			var clasNu;
			if (level >= 162) {
				clasNu = 10;
			} else if (level == 0) {
				clasNu = 0
			} else {
				clasNu = Math.floor(level / 18) + 1;
			}
			self.dom.callVolume.className = 'vol-level-{}'.format(clasNu);
		};
	};
	self.closeEvents = function (reason) {
		self.log('Destroying CallPeerConnection because', reason)();
		self.closePeerConnection();
		if (self.audioProcessors && audioProcessors.javascriptNode) {
			audioProcessors.javascriptNode.onaudioprocess = null;
		}
		self.dom.remote.pause();
		self.dom.remote.src = null;
		CssUtils.deleteElement(self.dom.videoContainer);
		self.removeChildPeerReference(self.opponentWsId, reason);
	};
	self.ondestroyCallConnection = function (message) {
		self.closeEvents("Opponent hang up");
	};
	self.init();
}

function WebRtcApi() {
	var self = this;
	self.dom = {
		webRtcFileIcon: $('webRtcFileIcon'),
		fileInput: $('webRtcFileInput')
	};
	self.connections = {};
	self.quedConnections = {};
	self.quedId = 0;
	self.clickFile = function () {
		self.dom.fileInput.value = null;
		self.dom.fileInput.click();
	};
	self.createQuedId = function () {
		return self.quedId++;
	};
	self.proxyHandler = function (data) {
		self.connections[data.connId]['on' + data.type](data);
	};
	self.toggleCallContainer = function () {
		channelsHandler.getActiveChannel().toggleCallHandler();
	};
	self.onsetConnectionId = function (message) {
		var el = self.quedConnections[message.id];
		delete self.quedConnections[message.id];
		self.connections[message.connId] = el;
		el.setConnectionId(message.connId);
	};
	self.onofferFile = function (message) {
		var handler = new FileReceiver(self.removeChildReference);
		self.connections[message.connId] = handler;
		handler.initAndDisplayOffer(message);
	};
	self.onofferCall = function (message) {
		var chatHandler = channelsHandler.channels[message.channel];
		if (!chatHandler) {
			throw "Somebody tried to call you to nonexisted channel";
		}
		var handler = chatHandler.createCallHandler();
		if (handler) {
			handler.setIsReceiver(true);
			self.connections[message.connId] = handler;
			handler.initAndDisplayOffer(message, chatHandler.roomName);
		} else {
			wsHandler.sendToServer({
				action: 'cancelCallConnection',
				connId: message.connId
			});
			growlInfo("User {} tried to call.".format(message.user));
		}
	};
	self.handle = function (data) {
		if (data.handler === 'webrtc') {
			self['on' + data.action](data);
		} else if (self.connections[data.connId]) {
			self.connections[data.connId].handle(data);
		} else {
			logger.error('Unable to handle "{}" because connection "{}" is unknown.' +
					' Available connections: "{}". Skipping message:',
					data.action, data.connId, Object.keys(self.connections))();
		}
	};
	self.addCallHandler = function (callHandler) {
		var newId = self.createQuedId();
		self.quedConnections[newId] = callHandler;
		return newId;
	};
	self.offerFile = function (file, channel) {
		var newId = self.createQuedId();
		self.quedConnections[newId] = new FileSender(self.removeChildReference, file);
		self.quedConnections[newId].sendOffer(newId, channel);
		return self.quedConnections[newId];
	};
	self.removeChildReference = function (id) {
		logger.info("Removing transferHandler with id {}", id)();
		delete self.connections[id];
	};
	self.attachEvents = function () {
		self.dom.webRtcFileIcon.onclick = self.clickFile;
		self.dom.fileInput.onchange = function () {
			self.offerFile(self.dom.fileInput.files[0], channelsHandler.activeChannel);
		};
	};
	self.attachEvents();
}


function WsHandler() {
	var self = this;
	self.wsState = 0; // 0 - not inited, 1 - tried to connect but failed; 9 - connected;
	self.dom = {
		onlineStatus: $('onlineStatus'),
		onlineClass: 'online',
		offlineClass: 'offline'
	};
	self.wsConnectionId = '';
	self.handlers = {
		channels: channelsHandler,
		chat: channelsHandler,
		ws: self,
		webrtc: webRtcApi,
		webrtcTransfer: webRtcApi,
		peerConnection: webRtcApi,
		growl: {
			handle: function (message) {
				growlError(message.content);
			}
		}
	};
	self.handle = function (message) {
		self.wsConnectionId = message.content;
		self.wsConnectionFullId = message.opponentWsId;
		logger.info("CONNECTION ID HAS BEEN SET TO {}, (full id is {})", self.wsConnectionId, self.wsConnectionFullId)();
	};
	self.onWsMessage = function (message) {
		var jsonData = message.data;
		logger.ws("WS_IN", jsonData)();
		var data = JSON.parse(jsonData);
		self.handleMessage(data);
		//cache some messages to localStorage save only after handle, in case of errors +  it changes the message,
		storage.saveMessageToStorage(data, jsonData);
	};
	self.handleMessage = function (data) {
		self.handlers[data.handler].handle(data);
	};
	self.sendToServer = function (messageRequest) {
		var jsonRequest = JSON.stringify(messageRequest);
		var logEntry = jsonRequest.substring(0, 500);
		if (self.ws.readyState !== WebSocket.OPEN) {
			logger.warn("Web socket is closed. Can't send {}", logEntry)();
			growlError("Can't send message, because connection is lost :(");
			return false;
		} else {
			logger.ws("WS out", logEntry)();
			self.ws.send(jsonRequest);
			return true;
		}
	};

	self.setStatus = function (isOnline) {
		var statusClass = isOnline ? self.dom.onlineClass : self.dom.offlineClass;
		CssUtils.setOnOf(self.dom.onlineStatus, statusClass, [self.dom.onlineClass, self.dom.offlineClass]);
		self.dom.onlineStatus.title = isOnline ? "Websocket connection established. You are online" : "You are offline. Connecting to server..."
	};
	self.onWsClose = function (e) {
		self.setStatus(false);
		var reason = e.reason || e;
		if (e.code === 403) {
			var message = "Server has forbidden request because '{}'".format(reason);
			growlError(message);
			logger.error(message)();
		} else if (self.wsState === 0) {
			growlError("Can't establish connection with server");
			logger.error("Chat server is down because {}", reason)();
		} else if (self.wsState === 9) {
			growlError("Connection to chat server has been lost, because {}".format(reason));
			logger.error(
					'Connection to WebSocket has failed because "{}". Trying to reconnect every {}ms',
					e.reason, CONNECTION_RETRY_TIME)();
		}
		self.wsState = 1;
		// Try to reconnect in 10 seconds
		setTimeout(self.listenWS, CONNECTION_RETRY_TIME);
	};
	self.listenWS = function () {
		if (!window.WebSocket) {
			growlError(getText("Your browser ({}) doesn't support webSockets. Supported browsers: " +
					"Android, Chrome, Opera, Safari, IE11, Edge, Firefox", window.browserVersion));
			return;
		}
		self.ws = new WebSocket(API_URL + self.wsConnectionId);
		self.ws.onmessage = self.onWsMessage;
		self.ws.onclose = self.onWsClose;
		self.ws.onopen = function () {
			self.setStatus(true);
			var message = "Connection to server has been established";
			if (self.wsState === 1) { // if not inited don't growl message on page load
				growlSuccess(message);
			}
			self.wsState = 9;
			logger.info(message)();
		};
	};
}

function Storage() {
	var self = this;
	self.STORAGE_NAME = 'main';
	self.actionsToSave = ['printMessage', 'loadMessages', 'editMessage', 'deleteMessage', 'loadOfflineMessages'];
	self.loadMessagesFromLocalStorage = function () {
		var jsonData = localStorage.getItem(self.STORAGE_NAME);
		if (jsonData != null) {
			var parsedData = JSON.parse(jsonData);
			logger.info('Loading {} messages from localstorage', parsedData.length)();
			// don't make sound on loadHistory
			var savedSoundStatus = window.sound;
			window.sound = 0;
			window.loggingEnabled = false;
			window.newMessagesDisabled = true;
			for (var i = 0; i < parsedData.length; i++) {
				try {
					wsHandler.handleMessage(parsedData[i]);
				} catch (err) {
					logger.warn("Message '{}' isn't loaded because {}",
							JSON.stringify(parsedData[i]), err)();
				}
			}
			window.loggingEnabled = true;
			window.newMessagesDisabled = false;
			window.sound = savedSoundStatus;
		}
	};
	// Use both json and object repr for less JSON actions
	self.saveMessageToStorage = function (objectItem, jsonItem) {
		if (notifier.isTabMain() && self.actionsToSave.indexOf(objectItem.action) >= 0 && cacheMessages) {
			self.fastAddToStorage(jsonItem);
		}
	};
	self.clearStorage = function () {
		localStorage.removeItem(self.STORAGE_NAME);
	};
	self.fastAddToStorage = function (text) {
		var storageData = localStorage.getItem(self.STORAGE_NAME);
		var newStorageData;
		if (storageData) {
			// insert new text before "]" symbol and add it manually
			var copyUntil = storageData.length - 1;
			newStorageData = storageData.substr(0, copyUntil) + ',' + text + ']';
		} else {
			newStorageData = '[' + text + ']';
		}
		localStorage.setItem(self.STORAGE_NAME, newStorageData);
	};
}

var Utils = {
	createUserLi: function (userId, gender, username) {
		var icon;
		icon = document.createElement('i');
		icon.className = GENDER_ICONS[gender];
		var li = document.createElement('li');
		li.appendChild(icon);
		li.innerHTML += username;
		li.setAttribute(USER_ID_ATTR, userId);
		li.setAttribute(USER_NAME_ATTR, username);
		return li;
	},
	setVideoSource: function (domEl, stream) {
		domEl.src = URL.createObjectURL(stream);
		domEl.play();
	},
	checkAndPlay: function (element) {
		if (!window.sound || !notifier.isTabMain()) {
			return;
		}
		try {
			element.pause();
			element.currentTime = 0;
			element.volume = volumeProportion[window.sound];
			element.play();
		} catch (e) {
			logger.error("Skipping playing message, because {}", e.message || e)();
		}
	},
	extractError: function (arguments) {
		try {
			if (typeof arguments === 'string') {
				return arguments;
			} else if (arguments.length > 1) {
				return Array.prototype.join.call(arguments, ' ');
			} else if (arguments.length === 1) {
				arguments = arguments[0];
			}
			return arguments && (arguments.name || arguments.message) ? "{}: {}".format(arguments.name, arguments.message) : JSON.stringify(arguments);
		} catch (e) {
			return "Error during parsing error, :("
		}
	},
	createMicrophoneLevelVoice: function (stream, onaudioprocess) {
		try {
			var audioTracks = stream && stream.getAudioTracks();
			audioTracks = audioTracks.length > 0 ? audioTracks[0] : false;
			if (!audioTracks) {
				throw "Stream has no audio tracks";
			}
			var audioProc = {};
			audioProc.audioContext = new AudioContext();
			audioProc.analyser = audioProc.audioContext.createAnalyser();
			var microphone = audioProc.audioContext.createMediaStreamSource(stream);
			audioProc.javascriptNode = audioProc.audioContext.createScriptProcessor(2048, 1, 1);
			audioProc.analyser.smoothingTimeConstant = 0.3;
			audioProc.analyser.fftSize = 1024;
			microphone.connect(audioProc.analyser);
			audioProc.analyser.connect(audioProc.javascriptNode);
			audioProc.javascriptNode.connect(audioProc.audioContext.destination);
			audioProc.prevVolumeValues = 0;
			audioProc.volumeValuesCount = 0;
			audioProc.javascriptNode.onaudioprocess = onaudioprocess(audioProc);
			return audioProc;
		} catch (err) {
			logger.error("Unable to use microphone level because {}", Utils.extractError(err))();
		}
	},
	getAverageAudioLevel: function (audioProc) {
		var array = new Uint8Array(audioProc.analyser.frequencyBinCount);
		audioProc.analyser.getByteFrequencyData(array);
		var values = 0;
		var length = array.length;
		for (var i = 0; i < length; i++) {
			values += array[i];
		}
		return values / length;
	},
	pasteHtmlAtCaret: function (img) {
		usermsg.focus();
		var sel = window.getSelection();
		var range = sel.getRangeAt(0);
		range.deleteContents();
		// Range.createContextualFragment() would be useful here but is
		// non-standard and not supported in all browsers (IE9, for one)
		var frag = document.createDocumentFragment();
		frag.appendChild(img);
		range.insertNode(frag);
		// Preserve the selection
		range = range.cloneRange();
		range.setStartAfter(img);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
	},
	pasteb64ImgToTextArea: function (b64, name) {
		var img = document.createElement('img');
		img.src = b64;
		if (name) {
			img.setAttribute('fileName', name);
		}
		img.className = PASTED_IMG_CLASS;
		Utils.pasteHtmlAtCaret(img);
	},
	pasteImgToTextArea: function (file) {
		if (file.type.indexOf("image") >= 0) {
			var reader = new FileReader();
			reader.onload = function (e) {
				Utils.pasteb64ImgToTextArea(e.target.result, file.name);
			};
			reader.readAsDataURL(file);
		} else {
			growlError("Pasted file is not an image");
		}

	},
	showHelp: function () {
		if (!suggestions) {
			return
		}
		var infoMessages = [
			"<span>Every time you join chat those help messages will be shown to you. " +
			"You can disable them in you profile settings (<i class='icon-wrench'></i> icon). Simply click on popup to hide them</span>",
			"<span>Browser will notify you on incoming message every time when chat tab is not active. " +
			"You can disable this option in your profile(<i class='icon-wrench'></i> icon).</span>",
			"<span>You can create a new room by clicking on <i class='icon-plus-squared'></i> icon." +
			" To delete created room hover mouse on its name and click on <i class='icon-cancel-circled-outline'></i> icon.</span>",
			"<span>You can make an audio/video call." +
			" Calls are only allowed for rooms you're in. If you want to call single person you need to create direct room to him. To make a call in room open call dialog by pressing <i class='icon-phone '></i> and click on phone <i class='icon-phone-circled'></i> All people in current channel are gonna be called</span>",
			"<span>You can change chat appearance in your profile. To open profile click on <i class='icon-wrench'></i> icon in top right corner</span>",
			"<span>You can write multiline message by pressing <b>shift+Enter</b></span>",
			"<span>You can add smileys by clicking on bottom right <i class='icon-smile'></i> icon." +
			" To close appeared smile container click outside of it or press <b>Esc</b></span>",
			"You can comment somebody's message. This will be shown to all users in current channel. Just click on message time" +
			"and it's content appears in message text",
			"<span>You have a feature to suggest or you lack some functionality? Click on <i class='icon-pencil'></i>icon on top menu and write your " +
			"suggestion there</span>",
			"<span>Chat uses your browser cache to store messages. To clear current cache click on " +
			"<i class='icon-clear'></i> icon on the top menu</span>",
			"<span>You can view offline users in current channel by clicking on <b>CHANNEL ONLINE</b> text</span>",
			"<span>You can invite a new user to current room by clicking on <i class='icon-user-plus'></i> icon</span>",
			"You can load history of current channel. For this you need to focus place with messages by simply" +
			" clicking on it and press arrow up/page up or just scroll up with mousewheel",
			"<span>You can collapse user list by pressing on <i class='icon-angle-circled-up'></i> icon</span>",
			"<span>You can send images to to chat by pasting them in bottom textarea by pressing <B>Ctrl + V</b></span>",
			"<span>You can edit/delete message that you have sent during 10 minutes. Focus input text, delete its content " +
			"and press <b>Up Arrow</b>. The edited message should become highlighted with outline. If you apply blank text the" +
			" message will be removed.To exit the mode press <b>Esc</b></span>"
		];
		var index = localStorage.getItem('HelpIndex');
		if (index == null) {
			index = 0;
		} else {
			index = parseInt(index);
		}
		if (index < infoMessages.length) {
			growlInfo(infoMessages[index]);
			localStorage.setItem('HelpIndex', index + 1);
		}
	}
};
