"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
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
var plugins_1 = require("../../../src/plugins");
var tools_1 = require("@langchain/core/tools");
var zod_1 = require("zod");
/**
 * Tool for getting token price information
 */
var GetTokenPriceTool = /** @class */ (function (_super) {
    __extends(GetTokenPriceTool, _super);
    function GetTokenPriceTool(client) {
        var _this = _super.call(this) || this;
        _this.client = client;
        _this.name = 'get_token_price';
        _this.description = 'Get the current price of a token on Hedera';
        _this.schema = zod_1.z.object({
            tokenId: zod_1.z.string().describe('The Hedera token ID (e.g., 0.0.12345)'),
        });
        return _this;
    }
    GetTokenPriceTool.prototype._call = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var mockPrices, price;
            return __generator(this, function (_a) {
                try {
                    mockPrices = {
                        '0.0.1234': 0.12,
                        '0.0.5678': 1.45,
                        '0.0.9012': 0.0023,
                    };
                    price = mockPrices[input.tokenId] || Math.random() * 10;
                    return [2 /*return*/, "Current price of token ".concat(input.tokenId, ": $").concat(price.toFixed(4), " USD")];
                }
                catch (error) {
                    return [2 /*return*/, "Error fetching token price: ".concat(error instanceof Error ? error.message : String(error))];
                }
                return [2 /*return*/];
            });
        });
    };
    return GetTokenPriceTool;
}(tools_1.StructuredTool));
/**
 * Tool for swapping tokens
 */
var SwapTokensTool = /** @class */ (function (_super) {
    __extends(SwapTokensTool, _super);
    function SwapTokensTool(client) {
        var _this = _super.call(this) || this;
        _this.client = client;
        _this.name = 'swap_tokens';
        _this.description = 'Swap one token for another on Hedera';
        _this.schema = zod_1.z.object({
            fromTokenId: zod_1.z.string().describe('The ID of the token to swap from (e.g., 0.0.12345)'),
            toTokenId: zod_1.z.string().describe('The ID of the token to swap to (e.g., 0.0.67890)'),
            amount: zod_1.z.number().positive().describe('The amount of the source token to swap'),
        });
        return _this;
    }
    SwapTokensTool.prototype._call = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var accountId, exchangeRate, receivedAmount;
            return __generator(this, function (_a) {
                try {
                    accountId = this.client.getAccountAndSigner().accountId;
                    exchangeRate = Math.random() * 2;
                    receivedAmount = input.amount * exchangeRate;
                    return [2 /*return*/, "Simulated swap of ".concat(input.amount, " tokens (").concat(input.fromTokenId, ") for ").concat(receivedAmount.toFixed(4), " tokens (").concat(input.toTokenId, ").\n\nNote: This is a mock implementation. In a real implementation, this would execute the swap through a DEX on Hedera.")];
                }
                catch (error) {
                    return [2 /*return*/, "Error performing token swap: ".concat(error instanceof Error ? error.message : String(error))];
                }
                return [2 /*return*/];
            });
        });
    };
    return SwapTokensTool;
}(tools_1.StructuredTool));
/**
 * Tool for checking token balance
 */
var CheckTokenBalanceTool = /** @class */ (function (_super) {
    __extends(CheckTokenBalanceTool, _super);
    function CheckTokenBalanceTool(client) {
        var _this = _super.call(this) || this;
        _this.client = client;
        _this.name = 'check_token_balance';
        _this.description = 'Check the balance of a token for an account on Hedera';
        _this.schema = zod_1.z.object({
            tokenId: zod_1.z.string().describe('The Hedera token ID (e.g., 0.0.12345)'),
            accountId: zod_1.z.string().optional().describe('The account ID to check (defaults to the operator account)'),
        });
        return _this;
    }
    CheckTokenBalanceTool.prototype._call = function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var operatorId, accountToCheck, mockBalance;
            return __generator(this, function (_a) {
                try {
                    operatorId = this.client.getAccountAndSigner().accountId;
                    accountToCheck = input.accountId || operatorId;
                    mockBalance = Math.floor(Math.random() * 10000);
                    return [2 /*return*/, "Token balance for account ".concat(accountToCheck, ":\n").concat(mockBalance, " tokens of ").concat(input.tokenId, "\n\nNote: This is a mock implementation. In a real implementation, this would query the actual token balance from the Hedera network.")];
                }
                catch (error) {
                    return [2 /*return*/, "Error checking token balance: ".concat(error instanceof Error ? error.message : String(error))];
                }
                return [2 /*return*/];
            });
        });
    };
    return CheckTokenBalanceTool;
}(tools_1.StructuredTool));
/**
 * DeFi Integration Plugin for the Standards Agent Kit
 */
var DeFiPlugin = /** @class */ (function (_super) {
    __extends(DeFiPlugin, _super);
    function DeFiPlugin() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.id = 'defi-integration';
        _this.name = 'DeFi Integration Plugin';
        _this.description = 'Provides tools to interact with DeFi protocols on Hedera';
        _this.version = '1.0.0';
        _this.author = 'Hashgraph Online';
        return _this;
    }
    DeFiPlugin.prototype.getTools = function () {
        return [
            new GetTokenPriceTool(this.context.client),
            new SwapTokensTool(this.context.client),
            new CheckTokenBalanceTool(this.context.client)
        ];
    };
    return DeFiPlugin;
}(plugins_1.BasePlugin));
exports.default = DeFiPlugin;
