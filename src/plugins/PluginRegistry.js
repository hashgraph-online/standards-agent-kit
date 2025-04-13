"use strict";
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
exports.PluginRegistry = void 0;
/**
 * Registry for managing plugins in the Standards Agent Kit
 */
var PluginRegistry = /** @class */ (function () {
    /**
     * Creates a new PluginRegistry instance
     * @param context The context to provide to plugins during initialization
     */
    function PluginRegistry(context) {
        this.plugins = new Map();
        this.context = context;
    }
    /**
     * Register a plugin with the registry
     * @param plugin The plugin to register
     * @throws Error if a plugin with the same ID is already registered
     */
    PluginRegistry.prototype.registerPlugin = function (plugin) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.plugins.has(plugin.id)) {
                            throw new Error("Plugin with ID ".concat(plugin.id, " is already registered"));
                        }
                        return [4 /*yield*/, plugin.initialize(this.context)];
                    case 1:
                        _a.sent();
                        this.plugins.set(plugin.id, plugin);
                        this.context.logger.info("Plugin registered: ".concat(plugin.name, " (").concat(plugin.id, ")"));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a plugin by ID
     * @param id The ID of the plugin to retrieve
     * @returns The plugin, or undefined if not found
     */
    PluginRegistry.prototype.getPlugin = function (id) {
        return this.plugins.get(id);
    };
    /**
     * Get all registered plugins
     * @returns Array of all registered plugins
     */
    PluginRegistry.prototype.getAllPlugins = function () {
        return Array.from(this.plugins.values());
    };
    /**
     * Get all tools from all registered plugins
     * @returns Array of all tools provided by registered plugins
     */
    PluginRegistry.prototype.getAllTools = function () {
        return this.getAllPlugins().flatMap(function (plugin) { return plugin.getTools(); });
    };
    /**
     * Unregister a plugin
     * @param id The ID of the plugin to unregister
     * @returns true if the plugin was unregistered, false if it wasn't found
     */
    PluginRegistry.prototype.unregisterPlugin = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var plugin, error_1, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        plugin = this.plugins.get(id);
                        if (!plugin) {
                            return [2 /*return*/, false];
                        }
                        if (!plugin.cleanup) return [3 /*break*/, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, plugin.cleanup()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        this.context.logger.error("Error during plugin cleanup: ".concat(error_1));
                        return [3 /*break*/, 4];
                    case 4:
                        result = this.plugins.delete(id);
                        if (result) {
                            this.context.logger.info("Plugin unregistered: ".concat(plugin.name, " (").concat(plugin.id, ")"));
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * Unregister all plugins
     */
    PluginRegistry.prototype.unregisterAllPlugins = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pluginIds, _i, pluginIds_1, id;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        pluginIds = Array.from(this.plugins.keys());
                        _i = 0, pluginIds_1 = pluginIds;
                        _a.label = 1;
                    case 1:
                        if (!(_i < pluginIds_1.length)) return [3 /*break*/, 4];
                        id = pluginIds_1[_i];
                        return [4 /*yield*/, this.unregisterPlugin(id)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return PluginRegistry;
}());
exports.PluginRegistry = PluginRegistry;
