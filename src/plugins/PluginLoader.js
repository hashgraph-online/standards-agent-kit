"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginLoader = void 0;
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
/**
 * Utility for loading plugins from different sources
 */
var PluginLoader = /** @class */ (function () {
    function PluginLoader() {
    }
    /**
     * Load a plugin from a directory
     * @param directory Path to the directory containing the plugin
     * @param context Context to provide to the plugin during initialization
     * @returns The loaded plugin instance
     */
    PluginLoader.loadFromDirectory = function (directory, context) {
        return __awaiter(this, void 0, void 0, function () {
            var manifestPath, manifestContent, manifest, mainPath, pluginModule, PluginClass, plugin, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        manifestPath = path.join(directory, 'plugin.json');
                        if (!fs.existsSync(manifestPath)) {
                            throw new Error("Plugin manifest not found at ".concat(manifestPath));
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        manifestContent = fs.readFileSync(manifestPath, 'utf8');
                        manifest = JSON.parse(manifestContent);
                        // Validate manifest
                        if (!manifest.id || !manifest.main) {
                            throw new Error('Invalid plugin manifest: missing required fields (id, main)');
                        }
                        mainPath = path.join(directory, manifest.main);
                        if (!fs.existsSync(mainPath)) {
                            throw new Error("Plugin main file not found at ".concat(mainPath));
                        }
                        return [4 /*yield*/, Promise.resolve("".concat(mainPath)).then(function (s) { return __importStar(require(s)); })];
                    case 2:
                        pluginModule = _a.sent();
                        PluginClass = pluginModule.default || pluginModule[manifest.id];
                        if (!PluginClass) {
                            throw new Error("Could not find plugin class in ".concat(mainPath));
                        }
                        plugin = new PluginClass();
                        // Validate that it implements the IPlugin interface
                        if (!this.isValidPlugin(plugin)) {
                            throw new Error("Plugin does not implement the IPlugin interface correctly");
                        }
                        return [2 /*return*/, plugin];
                    case 3:
                        error_1 = _a.sent();
                        throw new Error("Failed to load plugin from directory ".concat(directory, ": ").concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Load a plugin from an npm package
     * @param packageName Name of the npm package containing the plugin
     * @param context Context to provide to the plugin during initialization
     * @returns The loaded plugin instance
     */
    PluginLoader.loadFromPackage = function (packageName, context) {
        return __awaiter(this, void 0, void 0, function () {
            var packagePath, packageDir;
            return __generator(this, function (_a) {
                try {
                    packagePath = require.resolve(packageName);
                    packageDir = path.dirname(packagePath);
                    return [2 /*return*/, this.loadFromDirectory(packageDir, context)];
                }
                catch (error) {
                    throw new Error("Failed to load plugin from package ".concat(packageName, ": ").concat(error instanceof Error ? error.message : String(error)));
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Check if an object implements the IPlugin interface
     * @param obj Object to check
     * @returns true if the object implements IPlugin, false otherwise
     */
    PluginLoader.isValidPlugin = function (obj) {
        return (obj &&
            typeof obj.id === 'string' &&
            typeof obj.name === 'string' &&
            typeof obj.description === 'string' &&
            typeof obj.version === 'string' &&
            typeof obj.author === 'string' &&
            typeof obj.initialize === 'function' &&
            typeof obj.getTools === 'function');
    };
    return PluginLoader;
}());
exports.PluginLoader = PluginLoader;
