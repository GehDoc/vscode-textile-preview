/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./preview-src/pre.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./preview-src/csp.ts":
/*!****************************!*\
  !*** ./preview-src/csp.ts ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const settings_1 = __webpack_require__(/*! ./settings */ "./preview-src/settings.ts");
const strings_1 = __webpack_require__(/*! ./strings */ "./preview-src/strings.ts");
/**
 * Shows an alert when there is a content security policy violation.
 */
class CspAlerter {
    constructor() {
        this.didShow = false;
        this.didHaveCspWarning = false;
        document.addEventListener('securitypolicyviolation', () => {
            this.onCspWarning();
        });
        window.addEventListener('message', (event) => {
            if (event && event.data && event.data.name === 'vscode-did-block-svg') {
                this.onCspWarning();
            }
        });
    }
    setPoster(poster) {
        this.messaging = poster;
        if (this.didHaveCspWarning) {
            this.showCspWarning();
        }
    }
    onCspWarning() {
        this.didHaveCspWarning = true;
        this.showCspWarning();
    }
    showCspWarning() {
        const strings = strings_1.getStrings();
        const settings = settings_1.getSettings();
        if (this.didShow || settings.disableSecurityWarnings || !this.messaging) {
            return;
        }
        this.didShow = true;
        const notification = document.createElement('a');
        notification.innerText = strings.cspAlertMessageText;
        notification.setAttribute('id', 'code-csp-warning');
        notification.setAttribute('title', strings.cspAlertMessageTitle);
        notification.setAttribute('role', 'button');
        notification.setAttribute('aria-label', strings.cspAlertMessageLabel);
        notification.onclick = () => {
            this.messaging.postMessage('showPreviewSecuritySelector', { source: settings.source });
        };
        document.body.appendChild(notification);
    }
}
exports.CspAlerter = CspAlerter;


/***/ }),

/***/ "./preview-src/loading.ts":
/*!********************************!*\
  !*** ./preview-src/loading.ts ***!
  \********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
class StyleLoadingMonitor {
    constructor() {
        this.unloadedStyles = [];
        this.finishedLoading = false;
        const onStyleLoadError = (event) => {
            const source = event.target.dataset.source;
            this.unloadedStyles.push(source);
        };
        window.addEventListener('DOMContentLoaded', () => {
            for (const link of document.getElementsByClassName('code-user-style')) {
                if (link.dataset.source) {
                    link.onerror = onStyleLoadError;
                }
            }
        });
        window.addEventListener('load', () => {
            if (!this.unloadedStyles.length) {
                return;
            }
            this.finishedLoading = true;
            if (this.poster) {
                this.poster.postMessage('previewStyleLoadError', { unloadedStyles: this.unloadedStyles });
            }
        });
    }
    setPoster(poster) {
        this.poster = poster;
        if (this.finishedLoading) {
            poster.postMessage('previewStyleLoadError', { unloadedStyles: this.unloadedStyles });
        }
    }
}
exports.StyleLoadingMonitor = StyleLoadingMonitor;


/***/ }),

/***/ "./preview-src/pre.ts":
/*!****************************!*\
  !*** ./preview-src/pre.ts ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const csp_1 = __webpack_require__(/*! ./csp */ "./preview-src/csp.ts");
const loading_1 = __webpack_require__(/*! ./loading */ "./preview-src/loading.ts");
window.cspAlerter = new csp_1.CspAlerter();
window.styleLoadingMonitor = new loading_1.StyleLoadingMonitor();


/***/ }),

/***/ "./preview-src/settings.ts":
/*!*********************************!*\
  !*** ./preview-src/settings.ts ***!
  \*********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
let cachedSettings = undefined;
function getData(key) {
    const element = document.getElementById('vscode-textile-preview-data');
    if (element) {
        const data = element.getAttribute(key);
        if (data) {
            return JSON.parse(data);
        }
    }
    throw new Error(`Could not load data for ${key}`);
}
exports.getData = getData;
function getSettings() {
    if (cachedSettings) {
        return cachedSettings;
    }
    cachedSettings = getData('data-settings');
    if (cachedSettings) {
        return cachedSettings;
    }
    throw new Error('Could not load settings');
}
exports.getSettings = getSettings;


/***/ }),

/***/ "./preview-src/strings.ts":
/*!********************************!*\
  !*** ./preview-src/strings.ts ***!
  \********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
function getStrings() {
    const store = document.getElementById('vscode-textile-preview-data');
    if (store) {
        const data = store.getAttribute('data-strings');
        if (data) {
            return JSON.parse(data);
        }
    }
    throw new Error('Could not load strings');
}
exports.getStrings = getStrings;


/***/ })

/******/ });
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly8vd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vLy4vcHJldmlldy1zcmMvY3NwLnRzIiwid2VicGFjazovLy8uL3ByZXZpZXctc3JjL2xvYWRpbmcudHMiLCJ3ZWJwYWNrOi8vLy4vcHJldmlldy1zcmMvcHJlLnRzIiwid2VicGFjazovLy8uL3ByZXZpZXctc3JjL3NldHRpbmdzLnRzIiwid2VicGFjazovLy8uL3ByZXZpZXctc3JjL3N0cmluZ3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtRQUFBO1FBQ0E7O1FBRUE7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBOzs7UUFHQTtRQUNBOztRQUVBO1FBQ0E7O1FBRUE7UUFDQTtRQUNBO1FBQ0EsMENBQTBDLGdDQUFnQztRQUMxRTtRQUNBOztRQUVBO1FBQ0E7UUFDQTtRQUNBLHdEQUF3RCxrQkFBa0I7UUFDMUU7UUFDQSxpREFBaUQsY0FBYztRQUMvRDs7UUFFQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0EseUNBQXlDLGlDQUFpQztRQUMxRSxnSEFBZ0gsbUJBQW1CLEVBQUU7UUFDckk7UUFDQTs7UUFFQTtRQUNBO1FBQ0E7UUFDQSwyQkFBMkIsMEJBQTBCLEVBQUU7UUFDdkQsaUNBQWlDLGVBQWU7UUFDaEQ7UUFDQTtRQUNBOztRQUVBO1FBQ0Esc0RBQXNELCtEQUErRDs7UUFFckg7UUFDQTs7O1FBR0E7UUFDQTs7Ozs7Ozs7Ozs7Ozs7QUNsRkE7OztnR0FHZ0c7O0FBR2hHLHNGQUF5QztBQUN6QyxtRkFBdUM7QUFFdkM7O0dBRUc7QUFDSCxNQUFhLFVBQVU7SUFNdEI7UUFMUSxZQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ2hCLHNCQUFpQixHQUFHLEtBQUssQ0FBQztRQUtqQyxRQUFRLENBQUMsZ0JB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LENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3hCO0tBQ0Q7SUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLDJCQUEyQixHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQ25ELENBQUM7QUFWRCwwQkFVQztBQUVELFNBQWdCLFdBQVc7SUFDMUIsSUFBSSxjQUFjLEVBQUU7UUFDbkIsT0FBTyxjQUFjLENBQUM7S0FDdEI7SUFFRCxjQUFjLEdBQUcsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQzFDLElBQUksY0FBYyxFQUFFO1FBQ25CLE9BQU8sY0FBYyxDQUFDO0tBQ3RCO0lBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO0FBQzVDLENBQUM7QUFYRCxrQ0FXQzs7Ozs7Ozs7Ozs7Ozs7QUN6Q0Q7OztnR0FHZ0c7O0FBRWhHLFNBQWdCLFVBQVU7SUFDekIsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLGNBQWMsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0lBQ3JFLElBQUksS0FBSyxFQUFFO1FBQ1YsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNoRCxJQUFJLElBQUksRUFBRTtZQUNULE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN4QjtLQUNEO0lBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0FBQzNDLENBQUM7QUFURCxnQ0FTQyIsImZpbGUiOiJwcmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgXHQvLyBUaGUgbW9kdWxlIGNhY2hlXG4gXHR2YXIgaW5zdGFsbGVkTW9kdWxlcyA9IHt9O1xuXG4gXHQvLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuIFx0ZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXG4gXHRcdC8vIENoZWNrIGlmIG1vZHVsZSBpcyBpbiBjYWNoZVxuIFx0XHRpZihpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSkge1xuIFx0XHRcdHJldHVybiBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXS5leHBvcnRzO1xuIFx0XHR9XG4gXHRcdC8vIENyZWF0ZSBhIG5ldyBtb2R1bGUgKGFuZCBwdXQgaXQgaW50byB0aGUgY2FjaGUpXG4gXHRcdHZhciBtb2R1bGUgPSBpbnN0YWxsZWRNb2R1bGVzW21vZHVsZUlkXSA9IHtcbiBcdFx0XHRpOiBtb2R1bGVJZCxcbiBcdFx0XHRsOiBmYWxzZSxcbiBcdFx0XHRleHBvcnRzOiB7fVxuIFx0XHR9O1xuXG4gXHRcdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuIFx0XHRtb2R1bGVzW21vZHVsZUlkXS5jYWxsKG1vZHVsZS5leHBvcnRzLCBtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuIFx0XHQvLyBGbGFnIHRoZSBtb2R1bGUgYXMgbG9hZGVkXG4gXHRcdG1vZHVsZS5sID0gdHJ1ZTtcblxuIFx0XHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuIFx0XHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG4gXHR9XG5cblxuIFx0Ly8gZXhwb3NlIHRoZSBtb2R1bGVzIG9iamVjdCAoX193ZWJwYWNrX21vZHVsZXNfXylcbiBcdF9fd2VicGFja19yZXF1aXJlX18ubSA9IG1vZHVsZXM7XG5cbiBcdC8vIGV4cG9zZSB0aGUgbW9kdWxlIGNhY2hlXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLmMgPSBpbnN0YWxsZWRNb2R1bGVzO1xuXG4gXHQvLyBkZWZpbmUgZ2V0dGVyIGZ1bmN0aW9uIGZvciBoYXJtb255IGV4cG9ydHNcbiBcdF9fd2VicGFja19yZXF1aXJlX18uZCA9IGZ1bmN0aW9uKGV4cG9ydHMsIG5hbWUsIGdldHRlcikge1xuIFx0XHRpZighX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIG5hbWUpKSB7XG4gXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIG5hbWUsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBnZXR0ZXIgfSk7XG4gXHRcdH1cbiBcdH07XG5cbiBcdC8vIGRlZmluZSBfX2VzTW9kdWxlIG9uIGV4cG9ydHNcbiBcdF9fd2VicGFja19yZXF1aXJlX18uciA9IGZ1bmN0aW9uKGV4cG9ydHMpIHtcbiBcdFx0aWYodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnRvU3RyaW5nVGFnKSB7XG4gXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFN5bWJvbC50b1N0cmluZ1RhZywgeyB2YWx1ZTogJ01vZHVsZScgfSk7XG4gXHRcdH1cbiBcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywgeyB2YWx1ZTogdHJ1ZSB9KTtcbiBcdH07XG5cbiBcdC8vIGNyZWF0ZSBhIGZha2UgbmFtZXNwYWNlIG9iamVjdFxuIFx0Ly8gbW9kZSAmIDE6IHZhbHVlIGlzIGEgbW9kdWxlIGlkLCByZXF1aXJlIGl0XG4gXHQvLyBtb2RlICYgMjogbWVyZ2UgYWxsIHByb3BlcnRpZXMgb2YgdmFsdWUgaW50byB0aGUgbnNcbiBcdC8vIG1vZGUgJiA0OiByZXR1cm4gdmFsdWUgd2hlbiBhbHJlYWR5IG5zIG9iamVjdFxuIFx0Ly8gbW9kZSAmIDh8MTogYmVoYXZlIGxpa2UgcmVxdWlyZVxuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy50ID0gZnVuY3Rpb24odmFsdWUsIG1vZGUpIHtcbiBcdFx0aWYobW9kZSAmIDEpIHZhbHVlID0gX193ZWJwYWNrX3JlcXVpcmVfXyh2YWx1ZSk7XG4gXHRcdGlmKG1vZGUgJiA4KSByZXR1cm4gdmFsdWU7XG4gXHRcdGlmKChtb2RlICYgNCkgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAmJiB2YWx1ZS5fX2VzTW9kdWxlKSByZXR1cm4gdmFsdWU7XG4gXHRcdHZhciBucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gXHRcdF9fd2VicGFja19yZXF1aXJlX18ucihucyk7XG4gXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShucywgJ2RlZmF1bHQnLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2YWx1ZSB9KTtcbiBcdFx0aWYobW9kZSAmIDIgJiYgdHlwZW9mIHZhbHVlICE9ICdzdHJpbmcnKSBmb3IodmFyIGtleSBpbiB2YWx1ZSkgX193ZWJwYWNrX3JlcXVpcmVfXy5kKG5zLCBrZXksIGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gdmFsdWVba2V5XTsgfS5iaW5kKG51bGwsIGtleSkpO1xuIFx0XHRyZXR1cm4gbnM7XG4gXHR9O1xuXG4gXHQvLyBnZXREZWZhdWx0RXhwb3J0IGZ1bmN0aW9uIGZvciBjb21wYXRpYmlsaXR5IHdpdGggbm9uLWhhcm1vbnkgbW9kdWxlc1xuIFx0X193ZWJwYWNrX3JlcXVpcmVfXy5uID0gZnVuY3Rpb24obW9kdWxlKSB7XG4gXHRcdHZhciBnZXR0ZXIgPSBtb2R1bGUgJiYgbW9kdWxlLl9fZXNNb2R1bGUgP1xuIFx0XHRcdGZ1bmN0aW9uIGdldERlZmF1bHQoKSB7IHJldHVybiBtb2R1bGVbJ2RlZmF1bHQnXTsgfSA6XG4gXHRcdFx0ZnVuY3Rpb24gZ2V0TW9kdWxlRXhwb3J0cygpIHsgcmV0dXJuIG1vZHVsZTsgfTtcbiBcdFx0X193ZWJwYWNrX3JlcXVpcmVfXy5kKGdldHRlciwgJ2EnLCBnZXR0ZXIpO1xuIFx0XHRyZXR1cm4gZ2V0dGVyO1xuIFx0fTtcblxuIFx0Ly8gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLm8gPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5KSB7IHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBwcm9wZXJ0eSk7IH07XG5cbiBcdC8vIF9fd2VicGFja19wdWJsaWNfcGF0aF9fXG4gXHRfX3dlYnBhY2tfcmVxdWlyZV9fLnAgPSBcIlwiO1xuXG5cbiBcdC8vIExvYWQgZW50cnkgbW9kdWxlIGFuZCByZXR1cm4gZXhwb3J0c1xuIFx0cmV0dXJuIF9fd2VicGFja19yZXF1aXJlX18oX193ZWJwYWNrX3JlcXVpcmVfXy5zID0gXCIuL3ByZXZpZXctc3JjL3ByZS50c1wiKTtcbiIsIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBNZXNzYWdlUG9zdGVyIH0gZnJvbSAnLi9tZXNzYWdpbmcnO1xuaW1wb3J0IHsgZ2V0U2V0dGluZ3MgfSBmcm9tICcuL3NldHRpbmdzJztcbmltcG9ydCB7IGdldFN0cmluZ3MgfSBmcm9tICcuL3N0cmluZ3MnO1xuXG4vKipcbiAqIFNob3dzIGFuIGFsZXJ0IHdoZW4gdGhlcmUgaXMgYSBjb250ZW50IHNlY3VyaXR5IHBvbGljeSB2aW9sYXRpb24uXG4gKi9cbmV4cG9ydCBjbGFzcyBDc3BBbGVydGVyIHtcblx0cHJpdmF0ZSBkaWRTaG93ID0gZmFsc2U7XG5cdHByaXZhdGUgZGlkSGF2ZUNzcFdhcm5pbmcgPSBmYWxzZTtcblxuXHRwcml2YXRlIG1lc3NhZ2luZz86IE1lc3NhZ2VQb3N0ZXI7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignc2VjdXJpdHlwb2xpY3l2aW9sYXRpb24nLCAoKSA9PiB7XG5cdFx0XHR0aGlzLm9uQ3NwV2FybmluZygpO1xuXHRcdH0pO1xuXG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAoZXZlbnQpID0+IHtcblx0XHRcdGlmIChldmVudCAmJiBldmVudC5kYXRhICYmIGV2ZW50LmRhdGEubmFtZSA9PT0gJ3ZzY29kZS1kaWQtYmxvY2stc3ZnJykge1xuXHRcdFx0XHR0aGlzLm9uQ3NwV2FybmluZygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIHNldFBvc3Rlcihwb3N0ZXI6IE1lc3NhZ2VQb3N0ZXIpIHtcblx0XHR0aGlzLm1lc3NhZ2luZyA9IHBvc3Rlcjtcblx0XHRpZiAodGhpcy5kaWRIYXZlQ3NwV2FybmluZykge1xuXHRcdFx0dGhpcy5zaG93Q3NwV2FybmluZygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Dc3BXYXJuaW5nKCkge1xuXHRcdHRoaXMuZGlkSGF2ZUNzcFdhcm5pbmcgPSB0cnVlO1xuXHRcdHRoaXMuc2hvd0NzcFdhcm5pbmcoKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvd0NzcFdhcm5pbmcoKSB7XG5cdFx0Y29uc3Qgc3RyaW5ncyA9IGdldFN0cmluZ3MoKTtcblx0XHRjb25zdCBzZXR0aW5ncyA9IGdldFNldHRpbmdzKCk7XG5cblx0XHRpZiAodGhpcy5kaWRTaG93IHx8IHNldHRpbmdzLmRpc2FibGVTZWN1cml0eVdhcm5pbmdzIHx8ICF0aGlzLm1lc3NhZ2luZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmRpZFNob3cgPSB0cnVlO1xuXG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRcdG5vdGlmaWNhdGlvbi5pbm5lclRleHQgPSBzdHJpbmdzLmNzcEFsZXJ0TWVzc2FnZVRleHQ7XG5cdFx0bm90aWZpY2F0aW9uLnNldEF0dHJpYnV0ZSgnaWQnLCAnY29kZS1jc3Atd2FybmluZycpO1xuXHRcdG5vdGlmaWNhdGlvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgc3RyaW5ncy5jc3BBbGVydE1lc3NhZ2VUaXRsZSk7XG5cblx0XHRub3RpZmljYXRpb24uc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuXHRcdG5vdGlmaWNhdGlvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBzdHJpbmdzLmNzcEFsZXJ0TWVzc2FnZUxhYmVsKTtcblx0XHRub3RpZmljYXRpb24ub25jbGljayA9ICgpID0+IHtcblx0XHRcdHRoaXMubWVzc2FnaW5nIS5wb3N0TWVzc2FnZSgnc2hvd1ByZXZpZXdTZWN1cml0eVNlbGVjdG9yJywgeyBzb3VyY2U6IHNldHRpbmdzLnNvdXJjZSB9KTtcblx0XHR9O1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm90aWZpY2F0aW9uKTtcblx0fVxufVxuIiwiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBNZXNzYWdlUG9zdGVyIH0gZnJvbSAnLi9tZXNzYWdpbmcnO1xuXG5leHBvcnQgY2xhc3MgU3R5bGVMb2FkaW5nTW9uaXRvciB7XG5cdHByaXZhdGUgdW5sb2FkZWRTdHlsZXM6IHN0cmluZ1tdID0gW107XG5cdHByaXZhdGUgZmluaXNoZWRMb2FkaW5nOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBwb3N0ZXI/OiBNZXNzYWdlUG9zdGVyO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IG9uU3R5bGVMb2FkRXJyb3IgPSAoZXZlbnQ6IGFueSkgPT4ge1xuXHRcdFx0Y29uc3Qgc291cmNlID0gZXZlbnQudGFyZ2V0LmRhdGFzZXQuc291cmNlO1xuXHRcdFx0dGhpcy51bmxvYWRlZFN0eWxlcy5wdXNoKHNvdXJjZSk7XG5cdFx0fTtcblxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBsaW5rIG9mIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2NvZGUtdXNlci1zdHlsZScpIGFzIEhUTUxDb2xsZWN0aW9uT2Y8SFRNTEVsZW1lbnQ+KSB7XG5cdFx0XHRcdGlmIChsaW5rLmRhdGFzZXQuc291cmNlKSB7XG5cdFx0XHRcdFx0bGluay5vbmVycm9yID0gb25TdHlsZUxvYWRFcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMudW5sb2FkZWRTdHlsZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuZmluaXNoZWRMb2FkaW5nID0gdHJ1ZTtcblx0XHRcdGlmICh0aGlzLnBvc3Rlcikge1xuXHRcdFx0XHR0aGlzLnBvc3Rlci5wb3N0TWVzc2FnZSgncHJldmlld1N0eWxlTG9hZEVycm9yJywgeyB1bmxvYWRlZFN0eWxlczogdGhpcy51bmxvYWRlZFN0eWxlcyB9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBzZXRQb3N0ZXIocG9zdGVyOiBNZXNzYWdlUG9zdGVyKTogdm9pZCB7XG5cdFx0dGhpcy5wb3N0ZXIgPSBwb3N0ZXI7XG5cdFx0aWYgKHRoaXMuZmluaXNoZWRMb2FkaW5nKSB7XG5cdFx0XHRwb3N0ZXIucG9zdE1lc3NhZ2UoJ3ByZXZpZXdTdHlsZUxvYWRFcnJvcicsIHsgdW5sb2FkZWRTdHlsZXM6IHRoaXMudW5sb2FkZWRTdHlsZXMgfSk7XG5cdFx0fVxuXHR9XG59XG4iLCIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ3NwQWxlcnRlciB9IGZyb20gJy4vY3NwJztcbmltcG9ydCB7IFN0eWxlTG9hZGluZ01vbml0b3IgfSBmcm9tICcuL2xvYWRpbmcnO1xuXG5kZWNsYXJlIGdsb2JhbCB7XG5cdGludGVyZmFjZSBXaW5kb3cge1xuXHRcdGNzcEFsZXJ0ZXI6IENzcEFsZXJ0ZXI7XG5cdFx0c3R5bGVMb2FkaW5nTW9uaXRvcjogU3R5bGVMb2FkaW5nTW9uaXRvcjtcblx0fVxufVxuXG53aW5kb3cuY3NwQWxlcnRlciA9IG5ldyBDc3BBbGVydGVyKCk7XG53aW5kb3cuc3R5bGVMb2FkaW5nTW9uaXRvciA9IG5ldyBTdHlsZUxvYWRpbmdNb25pdG9yKCk7IiwiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJldmlld1NldHRpbmdzIHtcblx0cmVhZG9ubHkgc291cmNlOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGxpbmU6IG51bWJlcjtcblx0cmVhZG9ubHkgbGluZUNvdW50OiBudW1iZXI7XG5cdHJlYWRvbmx5IHNjcm9sbFByZXZpZXdXaXRoRWRpdG9yPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgc2Nyb2xsRWRpdG9yV2l0aFByZXZpZXc6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGRpc2FibGVTZWN1cml0eVdhcm5pbmdzOiBib29sZWFuO1xuXHRyZWFkb25seSBkb3VibGVDbGlja1RvU3dpdGNoVG9FZGl0b3I6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHdlYnZpZXdSZXNvdXJjZVJvb3Q6IHN0cmluZztcbn1cblxubGV0IGNhY2hlZFNldHRpbmdzOiBQcmV2aWV3U2V0dGluZ3MgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXREYXRhPFQgPSB7fT4oa2V5OiBzdHJpbmcpOiBUIHtcblx0Y29uc3QgZWxlbWVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd2c2NvZGUtdGV4dGlsZS1wcmV2aWV3LWRhdGEnKTtcblx0aWYgKGVsZW1lbnQpIHtcblx0XHRjb25zdCBkYXRhID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoa2V5KTtcblx0XHRpZiAoZGF0YSkge1xuXHRcdFx0cmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG5cdFx0fVxuXHR9XG5cblx0dGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgbG9hZCBkYXRhIGZvciAke2tleX1gKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNldHRpbmdzKCk6IFByZXZpZXdTZXR0aW5ncyB7XG5cdGlmIChjYWNoZWRTZXR0aW5ncykge1xuXHRcdHJldHVybiBjYWNoZWRTZXR0aW5ncztcblx0fVxuXG5cdGNhY2hlZFNldHRpbmdzID0gZ2V0RGF0YSgnZGF0YS1zZXR0aW5ncycpO1xuXHRpZiAoY2FjaGVkU2V0dGluZ3MpIHtcblx0XHRyZXR1cm4gY2FjaGVkU2V0dGluZ3M7XG5cdH1cblxuXHR0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBsb2FkIHNldHRpbmdzJyk7XG59XG4iLCIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN0cmluZ3MoKTogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSB7XG5cdGNvbnN0IHN0b3JlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3ZzY29kZS10ZXh0aWxlLXByZXZpZXctZGF0YScpO1xuXHRpZiAoc3RvcmUpIHtcblx0XHRjb25zdCBkYXRhID0gc3RvcmUuZ2V0QXR0cmlidXRlKCdkYXRhLXN0cmluZ3MnKTtcblx0XHRpZiAoZGF0YSkge1xuXHRcdFx0cmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG5cdFx0fVxuXHR9XG5cdHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGxvYWQgc3RyaW5ncycpO1xufVxuIl0sInNvdXJjZVJvb3QiOiIifQ==