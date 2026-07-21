/* eslint-disable */
// @ts-nocheck
/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) =>
  function __require() {
    try {
      return (
        mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod),
        mod.exports
      );
    } catch (e) {
      throw ((mod = 0), e);
    }
  };

// ../../node_modules/.pnpm/ajv@8.20.0/node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "../../node_modules/.pnpm/ajv@8.20.0/node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320) pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  },
});

// ../../node_modules/.pnpm/fast-deep-equal@3.1.3/node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "../../node_modules/.pnpm/fast-deep-equal@3.1.3/node_modules/fast-deep-equal/index.js"(
    exports,
    module,
  ) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0;) if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0;)
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0;) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  },
});

// ../../node_modules/.pnpm/ajv@8.20.0/node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "../../node_modules/.pnpm/ajv@8.20.0/node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  },
});

// ../../node_modules/.pnpm/ajv-formats@3.0.1_ajv@8.20.0/node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "../../node_modules/.pnpm/ajv-formats@3.0.1_ajv@8.20.0/node_modules/ajv-formats/dist/formats.js"(
    exports,
  ) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
    function fmtDef(validate, compare) {
      return { validate, compare };
    }
    exports.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(true), compareTime),
      "date-time": fmtDef(getDateTime(true), compareDateTime),
      "iso-time": fmtDef(getTime(), compareIsoTime),
      "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
      // duration: https://tools.ietf.org/html/rfc3339#appendix-A
      duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
      uri,
      "uri-reference":
        /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // uri-template: https://tools.ietf.org/html/rfc6570
      "uri-template":
        /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // For the source: https://gist.github.com/dperini/729294
      // For test cases: https://mathiasbynens.be/demo/url-regex
      url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
      email:
        /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
      hostname:
        /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
      regex,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
      "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
      // the following formats are used by the openapi specification: https://spec.openapis.org/oas/v3.0.0#data-types
      // byte: https://github.com/miguelmota/is-base64
      byte,
      // signed 32 bit integer
      int32: { type: "number", validate: validateInt32 },
      // signed 64 bit integer
      int64: { type: "number", validate: validateInt64 },
      // C-type float
      float: { type: "number", validate: validateNumber },
      // C-type double
      double: { type: "number", validate: validateNumber },
      // hint to the UI to hide input strings
      password: true,
      // unchecked string payload
      binary: true,
    };
    exports.fastFormats = {
      ...exports.fullFormats,
      date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
      time: fmtDef(
        /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i,
        compareTime,
      ),
      "date-time": fmtDef(
        /^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i,
        compareDateTime,
      ),
      "iso-time": fmtDef(
        /^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i,
        compareIsoTime,
      ),
      "iso-date-time": fmtDef(
        /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i,
        compareIsoDateTime,
      ),
      // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
      uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
      "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
      // email (sources from jsen validator):
      // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'wilful violation')
      email:
        /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i,
    };
    exports.formatNames = Object.keys(exports.fullFormats);
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      const matches = DATE.exec(str);
      if (!matches) return false;
      const year = +matches[1];
      const month = +matches[2];
      const day = +matches[3];
      return (
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month])
      );
    }
    function compareDate(d1, d2) {
      if (!(d1 && d2)) return void 0;
      if (d1 > d2) return 1;
      if (d1 < d2) return -1;
      return 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function time(str) {
        const matches = TIME.exec(str);
        if (!matches) return false;
        const hr = +matches[1];
        const min = +matches[2];
        const sec = +matches[3];
        const tz = matches[4];
        const tzSign = matches[5] === "-" ? -1 : 1;
        const tzH = +(matches[6] || 0);
        const tzM = +(matches[7] || 0);
        if (tzH > 23 || tzM > 59 || (strictTimeZone && !tz)) return false;
        if (hr <= 23 && min <= 59 && sec < 60) return true;
        const utcMin = min - tzM * tzSign;
        const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2)) return void 0;
      const t1 = /* @__PURE__ */ new Date("2020-01-01T" + s1).valueOf();
      const t2 = /* @__PURE__ */ new Date("2020-01-01T" + s2).valueOf();
      if (!(t1 && t2)) return void 0;
      return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2)) return void 0;
      const a1 = TIME.exec(t1);
      const a2 = TIME.exec(t2);
      if (!(a1 && a2)) return void 0;
      t1 = a1[1] + a1[2] + a1[3];
      t2 = a2[1] + a2[2] + a2[3];
      if (t1 > t2) return 1;
      if (t1 < t2) return -1;
      return 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      const time = getTime(strictTimeZone);
      return function date_time(str) {
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2)) return void 0;
      const d1 = new Date(dt1).valueOf();
      const d2 = new Date(dt2).valueOf();
      if (!(d1 && d2)) return void 0;
      return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2)) return void 0;
      const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
      const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
      const res = compareDate(d1, d2);
      if (res === void 0) return void 0;
      return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    var URI =
      /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      BYTE.lastIndex = 0;
      return BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31);
    var MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return true;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str)) return false;
      try {
        new RegExp(str);
        return true;
      } catch (e) {
        return false;
      }
    }
  },
});

// standalone-validators.mjs
var validateAiProviderSchema = validate20;
var schema31 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://financial-intelligence.local/schemas/ai-provider.schema.json",
  title: "AI Provider Profile",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "id", "name", "kind", "enabled", "tasks", "createdAt", "updatedAt"],
  properties: {
    schemaVersion: { const: "1.0.0" },
    id: { $ref: "#/$defs/uuid" },
    name: { type: "string", minLength: 1, maxLength: 100 },
    kind: { enum: ["none", "browserLocal", "selfHosted", "remote"] },
    enabled: { type: "boolean" },
    adapterId: { type: "string", minLength: 1, maxLength: 100 },
    adapterVersion: { type: "string", minLength: 1, maxLength: 40 },
    endpointOrigin: { type: "string", format: "uri", maxLength: 500 },
    model: { type: "string", minLength: 1, maxLength: 160 },
    tasks: {
      type: "array",
      uniqueItems: true,
      items: {
        enum: ["merchant.resolve.v1", "category.classify.v1", "query.plan.v1", "insight.word.v1"],
      },
    },
    secretRef: { type: "string", pattern: "^secret:[A-Za-z0-9._-]{1,120}$" },
    consent: { $ref: "#/$defs/consent" },
    localModel: { $ref: "#/$defs/localModel" },
    createdAt: { $ref: "#/$defs/dateTime" },
    updatedAt: { $ref: "#/$defs/dateTime" },
  },
  allOf: [
    {
      if: { properties: { kind: { const: "remote" } }, required: ["kind"] },
      then: { required: ["adapterId", "adapterVersion", "endpointOrigin", "model", "consent"] },
    },
    {
      if: { properties: { kind: { const: "selfHosted" } }, required: ["kind"] },
      then: { required: ["adapterId", "adapterVersion", "endpointOrigin", "model", "consent"] },
    },
    {
      if: { properties: { kind: { const: "browserLocal" } }, required: ["kind"] },
      then: { required: ["adapterId", "adapterVersion", "localModel"] },
    },
    {
      if: { properties: { kind: { const: "none" } }, required: ["kind"] },
      then: { properties: { tasks: { type: "array", maxItems: 0 } } },
    },
  ],
  $defs: {
    uuid: { type: "string", format: "uuid" },
    dateTime: { type: "string", format: "date-time" },
    consent: {
      type: "object",
      additionalProperties: false,
      required: ["disclosureVersion", "grantedAt", "dataClasses"],
      properties: {
        disclosureVersion: { type: "string", minLength: 1, maxLength: 40 },
        grantedAt: { $ref: "#/$defs/dateTime" },
        dataClasses: {
          type: "array",
          uniqueItems: true,
          items: {
            enum: [
              "normalizedDescription",
              "merchantLabel",
              "amountDirection",
              "amountBucket",
              "categoryVocabulary",
              "question",
              "aggregateFacts",
            ],
          },
        },
      },
    },
    localModel: {
      type: "object",
      additionalProperties: false,
      required: ["source", "revision", "sha256", "byteSize", "license"],
      properties: {
        source: { type: "string", format: "uri", maxLength: 500 },
        revision: { type: "string", minLength: 1, maxLength: 160 },
        sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
        byteSize: { type: "integer", minimum: 1 },
        license: { type: "string", minLength: 1, maxLength: 120 },
      },
    },
  },
};
var func1 = Object.prototype.hasOwnProperty;
var func2 = require_ucs2length().default;
var func0 = require_equal().default;
var formats0 = /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
var formats2 = require_formats().fullFormats.uri;
var formats4 = require_formats().fullFormats["date-time"];
var pattern4 = new RegExp("^secret:[A-Za-z0-9._-]{1,120}$", "u");
var pattern5 = new RegExp("^[0-9a-f]{64}$", "u");
var schema33 = {
  type: "object",
  additionalProperties: false,
  required: ["disclosureVersion", "grantedAt", "dataClasses"],
  properties: {
    disclosureVersion: { type: "string", minLength: 1, maxLength: 40 },
    grantedAt: { $ref: "#/$defs/dateTime" },
    dataClasses: {
      type: "array",
      uniqueItems: true,
      items: {
        enum: [
          "normalizedDescription",
          "merchantLabel",
          "amountDirection",
          "amountBucket",
          "categoryVocabulary",
          "question",
          "aggregateFacts",
        ],
      },
    },
  },
};
function validate21(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate21.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.disclosureVersion === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "disclosureVersion" },
        message: "must have required property 'disclosureVersion'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.grantedAt === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "grantedAt" },
        message: "must have required property 'grantedAt'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.dataClasses === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "dataClasses" },
        message: "must have required property 'dataClasses'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "disclosureVersion" || key0 === "grantedAt" || key0 === "dataClasses")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.disclosureVersion !== void 0) {
      let data0 = data.disclosureVersion;
      if (typeof data0 === "string") {
        if (func2(data0) > 40) {
          const err4 = {
            instancePath: instancePath + "/disclosureVersion",
            schemaPath: "#/properties/disclosureVersion/maxLength",
            keyword: "maxLength",
            params: { limit: 40 },
            message: "must NOT have more than 40 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err5 = {
            instancePath: instancePath + "/disclosureVersion",
            schemaPath: "#/properties/disclosureVersion/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/disclosureVersion",
          schemaPath: "#/properties/disclosureVersion/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.grantedAt !== void 0) {
      let data1 = data.grantedAt;
      if (typeof data1 === "string") {
        if (!formats4.validate(data1)) {
          const err7 = {
            instancePath: instancePath + "/grantedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/grantedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.dataClasses !== void 0) {
      let data2 = data.dataClasses;
      if (Array.isArray(data2)) {
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (!(
            data3 === "normalizedDescription" ||
            data3 === "merchantLabel" ||
            data3 === "amountDirection" ||
            data3 === "amountBucket" ||
            data3 === "categoryVocabulary" ||
            data3 === "question" ||
            data3 === "aggregateFacts"
          )) {
            const err9 = {
              instancePath: instancePath + "/dataClasses/" + i0,
              schemaPath: "#/properties/dataClasses/items/enum",
              keyword: "enum",
              params: { allowedValues: schema33.properties.dataClasses.items.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        let i1 = data2.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data2[i1], data2[j0])) {
                const err10 = {
                  instancePath: instancePath + "/dataClasses",
                  schemaPath: "#/properties/dataClasses/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err10];
                } else {
                  vErrors.push(err10);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err11 = {
          instancePath: instancePath + "/dataClasses",
          schemaPath: "#/properties/dataClasses/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
  } else {
    const err12 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate21.errors = vErrors;
  return errors === 0;
}
validate21.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (data.kind === void 0 && (missing0 = "kind")) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    } else {
      if (data.kind !== void 0) {
        if ("remote" !== data.kind) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs5 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.adapterId === void 0) {
        const err2 = {
          instancePath,
          schemaPath: "#/allOf/0/then/required",
          keyword: "required",
          params: { missingProperty: "adapterId" },
          message: "must have required property 'adapterId'",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
      if (data.adapterVersion === void 0) {
        const err3 = {
          instancePath,
          schemaPath: "#/allOf/0/then/required",
          keyword: "required",
          params: { missingProperty: "adapterVersion" },
          message: "must have required property 'adapterVersion'",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if (data.endpointOrigin === void 0) {
        const err4 = {
          instancePath,
          schemaPath: "#/allOf/0/then/required",
          keyword: "required",
          params: { missingProperty: "endpointOrigin" },
          message: "must have required property 'endpointOrigin'",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
      if (data.model === void 0) {
        const err5 = {
          instancePath,
          schemaPath: "#/allOf/0/then/required",
          keyword: "required",
          params: { missingProperty: "model" },
          message: "must have required property 'model'",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (data.consent === void 0) {
        const err6 = {
          instancePath,
          schemaPath: "#/allOf/0/then/required",
          keyword: "required",
          params: { missingProperty: "consent" },
          message: "must have required property 'consent'",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    var _valid0 = _errs5 === errors;
    valid1 = _valid0;
  }
  if (!valid1) {
    const err7 = {
      instancePath,
      schemaPath: "#/allOf/0/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  const _errs7 = errors;
  let valid3 = true;
  const _errs8 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing1;
    if (data.kind === void 0 && (missing1 = "kind")) {
      const err8 = {};
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    } else {
      if (data.kind !== void 0) {
        if ("selfHosted" !== data.kind) {
          const err9 = {};
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      }
    }
  }
  var _valid1 = _errs8 === errors;
  errors = _errs7;
  if (vErrors !== null) {
    if (_errs7) {
      vErrors.length = _errs7;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs10 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.adapterId === void 0) {
        const err10 = {
          instancePath,
          schemaPath: "#/allOf/1/then/required",
          keyword: "required",
          params: { missingProperty: "adapterId" },
          message: "must have required property 'adapterId'",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      if (data.adapterVersion === void 0) {
        const err11 = {
          instancePath,
          schemaPath: "#/allOf/1/then/required",
          keyword: "required",
          params: { missingProperty: "adapterVersion" },
          message: "must have required property 'adapterVersion'",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (data.endpointOrigin === void 0) {
        const err12 = {
          instancePath,
          schemaPath: "#/allOf/1/then/required",
          keyword: "required",
          params: { missingProperty: "endpointOrigin" },
          message: "must have required property 'endpointOrigin'",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      if (data.model === void 0) {
        const err13 = {
          instancePath,
          schemaPath: "#/allOf/1/then/required",
          keyword: "required",
          params: { missingProperty: "model" },
          message: "must have required property 'model'",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      if (data.consent === void 0) {
        const err14 = {
          instancePath,
          schemaPath: "#/allOf/1/then/required",
          keyword: "required",
          params: { missingProperty: "consent" },
          message: "must have required property 'consent'",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    var _valid1 = _errs10 === errors;
    valid3 = _valid1;
  }
  if (!valid3) {
    const err15 = {
      instancePath,
      schemaPath: "#/allOf/1/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  const _errs12 = errors;
  let valid5 = true;
  const _errs13 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing2;
    if (data.kind === void 0 && (missing2 = "kind")) {
      const err16 = {};
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    } else {
      if (data.kind !== void 0) {
        if ("browserLocal" !== data.kind) {
          const err17 = {};
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      }
    }
  }
  var _valid2 = _errs13 === errors;
  errors = _errs12;
  if (vErrors !== null) {
    if (_errs12) {
      vErrors.length = _errs12;
    } else {
      vErrors = null;
    }
  }
  if (_valid2) {
    const _errs15 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.adapterId === void 0) {
        const err18 = {
          instancePath,
          schemaPath: "#/allOf/2/then/required",
          keyword: "required",
          params: { missingProperty: "adapterId" },
          message: "must have required property 'adapterId'",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
      if (data.adapterVersion === void 0) {
        const err19 = {
          instancePath,
          schemaPath: "#/allOf/2/then/required",
          keyword: "required",
          params: { missingProperty: "adapterVersion" },
          message: "must have required property 'adapterVersion'",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
      if (data.localModel === void 0) {
        const err20 = {
          instancePath,
          schemaPath: "#/allOf/2/then/required",
          keyword: "required",
          params: { missingProperty: "localModel" },
          message: "must have required property 'localModel'",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    var _valid2 = _errs15 === errors;
    valid5 = _valid2;
  }
  if (!valid5) {
    const err21 = {
      instancePath,
      schemaPath: "#/allOf/2/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err21];
    } else {
      vErrors.push(err21);
    }
    errors++;
  }
  const _errs17 = errors;
  let valid7 = true;
  const _errs18 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing3;
    if (data.kind === void 0 && (missing3 = "kind")) {
      const err22 = {};
      if (vErrors === null) {
        vErrors = [err22];
      } else {
        vErrors.push(err22);
      }
      errors++;
    } else {
      if (data.kind !== void 0) {
        if ("none" !== data.kind) {
          const err23 = {};
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      }
    }
  }
  var _valid3 = _errs18 === errors;
  errors = _errs17;
  if (vErrors !== null) {
    if (_errs17) {
      vErrors.length = _errs17;
    } else {
      vErrors = null;
    }
  }
  if (_valid3) {
    const _errs20 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.tasks !== void 0) {
        let data4 = data.tasks;
        if (Array.isArray(data4)) {
          if (data4.length > 0) {
            const err24 = {
              instancePath: instancePath + "/tasks",
              schemaPath: "#/allOf/3/then/properties/tasks/maxItems",
              keyword: "maxItems",
              params: { limit: 0 },
              message: "must NOT have more than 0 items",
            };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        } else {
          const err25 = {
            instancePath: instancePath + "/tasks",
            schemaPath: "#/allOf/3/then/properties/tasks/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      }
    }
    var _valid3 = _errs20 === errors;
    valid7 = _valid3;
    if (valid7) {
      var props0 = {};
      props0.tasks = true;
      props0.kind = true;
    }
  }
  if (!valid7) {
    const err26 = {
      instancePath,
      schemaPath: "#/allOf/3/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  }
  if (props0 !== true) {
    props0 = props0 || {};
    props0.kind = true;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err27 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property 'schemaVersion'",
      };
      if (vErrors === null) {
        vErrors = [err27];
      } else {
        vErrors.push(err27);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err28 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    }
    if (data.name === void 0) {
      const err29 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err29];
      } else {
        vErrors.push(err29);
      }
      errors++;
    }
    if (data.kind === void 0) {
      const err30 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property 'kind'",
      };
      if (vErrors === null) {
        vErrors = [err30];
      } else {
        vErrors.push(err30);
      }
      errors++;
    }
    if (data.enabled === void 0) {
      const err31 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "enabled" },
        message: "must have required property 'enabled'",
      };
      if (vErrors === null) {
        vErrors = [err31];
      } else {
        vErrors.push(err31);
      }
      errors++;
    }
    if (data.tasks === void 0) {
      const err32 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "tasks" },
        message: "must have required property 'tasks'",
      };
      if (vErrors === null) {
        vErrors = [err32];
      } else {
        vErrors.push(err32);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err33 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err33];
      } else {
        vErrors.push(err33);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err34 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err34];
      } else {
        vErrors.push(err34);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema31.properties, key0)) {
        const err35 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err35];
        } else {
          vErrors.push(err35);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      if ("1.0.0" !== data.schemaVersion) {
        const err36 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "1.0.0" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data6 = data.id;
      if (typeof data6 === "string") {
        if (!formats0.test(data6)) {
          const err37 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
      } else {
        const err38 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data7 = data.name;
      if (typeof data7 === "string") {
        if (func2(data7) > 100) {
          const err39 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/maxLength",
            keyword: "maxLength",
            params: { limit: 100 },
            message: "must NOT have more than 100 characters",
          };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
        if (func2(data7) < 1) {
          const err40 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
      } else {
        const err41 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
    if (data.kind !== void 0) {
      let data8 = data.kind;
      if (!(
        data8 === "none" ||
        data8 === "browserLocal" ||
        data8 === "selfHosted" ||
        data8 === "remote"
      )) {
        const err42 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/enum",
          keyword: "enum",
          params: { allowedValues: schema31.properties.kind.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err42];
        } else {
          vErrors.push(err42);
        }
        errors++;
      }
    }
    if (data.enabled !== void 0) {
      if (typeof data.enabled !== "boolean") {
        const err43 = {
          instancePath: instancePath + "/enabled",
          schemaPath: "#/properties/enabled/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err43];
        } else {
          vErrors.push(err43);
        }
        errors++;
      }
    }
    if (data.adapterId !== void 0) {
      let data10 = data.adapterId;
      if (typeof data10 === "string") {
        if (func2(data10) > 100) {
          const err44 = {
            instancePath: instancePath + "/adapterId",
            schemaPath: "#/properties/adapterId/maxLength",
            keyword: "maxLength",
            params: { limit: 100 },
            message: "must NOT have more than 100 characters",
          };
          if (vErrors === null) {
            vErrors = [err44];
          } else {
            vErrors.push(err44);
          }
          errors++;
        }
        if (func2(data10) < 1) {
          const err45 = {
            instancePath: instancePath + "/adapterId",
            schemaPath: "#/properties/adapterId/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err45];
          } else {
            vErrors.push(err45);
          }
          errors++;
        }
      } else {
        const err46 = {
          instancePath: instancePath + "/adapterId",
          schemaPath: "#/properties/adapterId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
    }
    if (data.adapterVersion !== void 0) {
      let data11 = data.adapterVersion;
      if (typeof data11 === "string") {
        if (func2(data11) > 40) {
          const err47 = {
            instancePath: instancePath + "/adapterVersion",
            schemaPath: "#/properties/adapterVersion/maxLength",
            keyword: "maxLength",
            params: { limit: 40 },
            message: "must NOT have more than 40 characters",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
        if (func2(data11) < 1) {
          const err48 = {
            instancePath: instancePath + "/adapterVersion",
            schemaPath: "#/properties/adapterVersion/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err48];
          } else {
            vErrors.push(err48);
          }
          errors++;
        }
      } else {
        const err49 = {
          instancePath: instancePath + "/adapterVersion",
          schemaPath: "#/properties/adapterVersion/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err49];
        } else {
          vErrors.push(err49);
        }
        errors++;
      }
    }
    if (data.endpointOrigin !== void 0) {
      let data12 = data.endpointOrigin;
      if (typeof data12 === "string") {
        if (func2(data12) > 500) {
          const err50 = {
            instancePath: instancePath + "/endpointOrigin",
            schemaPath: "#/properties/endpointOrigin/maxLength",
            keyword: "maxLength",
            params: { limit: 500 },
            message: "must NOT have more than 500 characters",
          };
          if (vErrors === null) {
            vErrors = [err50];
          } else {
            vErrors.push(err50);
          }
          errors++;
        }
        if (!formats2(data12)) {
          const err51 = {
            instancePath: instancePath + "/endpointOrigin",
            schemaPath: "#/properties/endpointOrigin/format",
            keyword: "format",
            params: { format: "uri" },
            message: 'must match format "uri"',
          };
          if (vErrors === null) {
            vErrors = [err51];
          } else {
            vErrors.push(err51);
          }
          errors++;
        }
      } else {
        const err52 = {
          instancePath: instancePath + "/endpointOrigin",
          schemaPath: "#/properties/endpointOrigin/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err52];
        } else {
          vErrors.push(err52);
        }
        errors++;
      }
    }
    if (data.model !== void 0) {
      let data13 = data.model;
      if (typeof data13 === "string") {
        if (func2(data13) > 160) {
          const err53 = {
            instancePath: instancePath + "/model",
            schemaPath: "#/properties/model/maxLength",
            keyword: "maxLength",
            params: { limit: 160 },
            message: "must NOT have more than 160 characters",
          };
          if (vErrors === null) {
            vErrors = [err53];
          } else {
            vErrors.push(err53);
          }
          errors++;
        }
        if (func2(data13) < 1) {
          const err54 = {
            instancePath: instancePath + "/model",
            schemaPath: "#/properties/model/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err54];
          } else {
            vErrors.push(err54);
          }
          errors++;
        }
      } else {
        const err55 = {
          instancePath: instancePath + "/model",
          schemaPath: "#/properties/model/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err55];
        } else {
          vErrors.push(err55);
        }
        errors++;
      }
    }
    if (data.tasks !== void 0) {
      let data14 = data.tasks;
      if (Array.isArray(data14)) {
        const len0 = data14.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data15 = data14[i0];
          if (!(
            data15 === "merchant.resolve.v1" ||
            data15 === "category.classify.v1" ||
            data15 === "query.plan.v1" ||
            data15 === "insight.word.v1"
          )) {
            const err56 = {
              instancePath: instancePath + "/tasks/" + i0,
              schemaPath: "#/properties/tasks/items/enum",
              keyword: "enum",
              params: { allowedValues: schema31.properties.tasks.items.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err56];
            } else {
              vErrors.push(err56);
            }
            errors++;
          }
        }
        let i1 = data14.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data14[i1], data14[j0])) {
                const err57 = {
                  instancePath: instancePath + "/tasks",
                  schemaPath: "#/properties/tasks/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err57];
                } else {
                  vErrors.push(err57);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err58 = {
          instancePath: instancePath + "/tasks",
          schemaPath: "#/properties/tasks/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err58];
        } else {
          vErrors.push(err58);
        }
        errors++;
      }
    }
    if (data.secretRef !== void 0) {
      let data16 = data.secretRef;
      if (typeof data16 === "string") {
        if (!pattern4.test(data16)) {
          const err59 = {
            instancePath: instancePath + "/secretRef",
            schemaPath: "#/properties/secretRef/pattern",
            keyword: "pattern",
            params: { pattern: "^secret:[A-Za-z0-9._-]{1,120}$" },
            message: 'must match pattern "^secret:[A-Za-z0-9._-]{1,120}$"',
          };
          if (vErrors === null) {
            vErrors = [err59];
          } else {
            vErrors.push(err59);
          }
          errors++;
        }
      } else {
        const err60 = {
          instancePath: instancePath + "/secretRef",
          schemaPath: "#/properties/secretRef/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err60];
        } else {
          vErrors.push(err60);
        }
        errors++;
      }
    }
    if (data.consent !== void 0) {
      if (
        !validate21(data.consent, {
          instancePath: instancePath + "/consent",
          parentData: data,
          parentDataProperty: "consent",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);
        errors = vErrors.length;
      }
    }
    if (data.localModel !== void 0) {
      let data18 = data.localModel;
      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
        if (data18.source === void 0) {
          const err61 = {
            instancePath: instancePath + "/localModel",
            schemaPath: "#/$defs/localModel/required",
            keyword: "required",
            params: { missingProperty: "source" },
            message: "must have required property 'source'",
          };
          if (vErrors === null) {
            vErrors = [err61];
          } else {
            vErrors.push(err61);
          }
          errors++;
        }
        if (data18.revision === void 0) {
          const err62 = {
            instancePath: instancePath + "/localModel",
            schemaPath: "#/$defs/localModel/required",
            keyword: "required",
            params: { missingProperty: "revision" },
            message: "must have required property 'revision'",
          };
          if (vErrors === null) {
            vErrors = [err62];
          } else {
            vErrors.push(err62);
          }
          errors++;
        }
        if (data18.sha256 === void 0) {
          const err63 = {
            instancePath: instancePath + "/localModel",
            schemaPath: "#/$defs/localModel/required",
            keyword: "required",
            params: { missingProperty: "sha256" },
            message: "must have required property 'sha256'",
          };
          if (vErrors === null) {
            vErrors = [err63];
          } else {
            vErrors.push(err63);
          }
          errors++;
        }
        if (data18.byteSize === void 0) {
          const err64 = {
            instancePath: instancePath + "/localModel",
            schemaPath: "#/$defs/localModel/required",
            keyword: "required",
            params: { missingProperty: "byteSize" },
            message: "must have required property 'byteSize'",
          };
          if (vErrors === null) {
            vErrors = [err64];
          } else {
            vErrors.push(err64);
          }
          errors++;
        }
        if (data18.license === void 0) {
          const err65 = {
            instancePath: instancePath + "/localModel",
            schemaPath: "#/$defs/localModel/required",
            keyword: "required",
            params: { missingProperty: "license" },
            message: "must have required property 'license'",
          };
          if (vErrors === null) {
            vErrors = [err65];
          } else {
            vErrors.push(err65);
          }
          errors++;
        }
        for (const key1 in data18) {
          if (!(
            key1 === "source" ||
            key1 === "revision" ||
            key1 === "sha256" ||
            key1 === "byteSize" ||
            key1 === "license"
          )) {
            const err66 = {
              instancePath: instancePath + "/localModel",
              schemaPath: "#/$defs/localModel/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err66];
            } else {
              vErrors.push(err66);
            }
            errors++;
          }
        }
        if (data18.source !== void 0) {
          let data19 = data18.source;
          if (typeof data19 === "string") {
            if (func2(data19) > 500) {
              const err67 = {
                instancePath: instancePath + "/localModel/source",
                schemaPath: "#/$defs/localModel/properties/source/maxLength",
                keyword: "maxLength",
                params: { limit: 500 },
                message: "must NOT have more than 500 characters",
              };
              if (vErrors === null) {
                vErrors = [err67];
              } else {
                vErrors.push(err67);
              }
              errors++;
            }
            if (!formats2(data19)) {
              const err68 = {
                instancePath: instancePath + "/localModel/source",
                schemaPath: "#/$defs/localModel/properties/source/format",
                keyword: "format",
                params: { format: "uri" },
                message: 'must match format "uri"',
              };
              if (vErrors === null) {
                vErrors = [err68];
              } else {
                vErrors.push(err68);
              }
              errors++;
            }
          } else {
            const err69 = {
              instancePath: instancePath + "/localModel/source",
              schemaPath: "#/$defs/localModel/properties/source/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err69];
            } else {
              vErrors.push(err69);
            }
            errors++;
          }
        }
        if (data18.revision !== void 0) {
          let data20 = data18.revision;
          if (typeof data20 === "string") {
            if (func2(data20) > 160) {
              const err70 = {
                instancePath: instancePath + "/localModel/revision",
                schemaPath: "#/$defs/localModel/properties/revision/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err70];
              } else {
                vErrors.push(err70);
              }
              errors++;
            }
            if (func2(data20) < 1) {
              const err71 = {
                instancePath: instancePath + "/localModel/revision",
                schemaPath: "#/$defs/localModel/properties/revision/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err71];
              } else {
                vErrors.push(err71);
              }
              errors++;
            }
          } else {
            const err72 = {
              instancePath: instancePath + "/localModel/revision",
              schemaPath: "#/$defs/localModel/properties/revision/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err72];
            } else {
              vErrors.push(err72);
            }
            errors++;
          }
        }
        if (data18.sha256 !== void 0) {
          let data21 = data18.sha256;
          if (typeof data21 === "string") {
            if (!pattern5.test(data21)) {
              const err73 = {
                instancePath: instancePath + "/localModel/sha256",
                schemaPath: "#/$defs/localModel/properties/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9a-f]{64}$" },
                message: 'must match pattern "^[0-9a-f]{64}$"',
              };
              if (vErrors === null) {
                vErrors = [err73];
              } else {
                vErrors.push(err73);
              }
              errors++;
            }
          } else {
            const err74 = {
              instancePath: instancePath + "/localModel/sha256",
              schemaPath: "#/$defs/localModel/properties/sha256/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err74];
            } else {
              vErrors.push(err74);
            }
            errors++;
          }
        }
        if (data18.byteSize !== void 0) {
          let data22 = data18.byteSize;
          if (!(typeof data22 == "number" && !(data22 % 1) && !isNaN(data22) && isFinite(data22))) {
            const err75 = {
              instancePath: instancePath + "/localModel/byteSize",
              schemaPath: "#/$defs/localModel/properties/byteSize/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err75];
            } else {
              vErrors.push(err75);
            }
            errors++;
          }
          if (typeof data22 == "number" && isFinite(data22)) {
            if (data22 < 1 || isNaN(data22)) {
              const err76 = {
                instancePath: instancePath + "/localModel/byteSize",
                schemaPath: "#/$defs/localModel/properties/byteSize/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err76];
              } else {
                vErrors.push(err76);
              }
              errors++;
            }
          }
        }
        if (data18.license !== void 0) {
          let data23 = data18.license;
          if (typeof data23 === "string") {
            if (func2(data23) > 120) {
              const err77 = {
                instancePath: instancePath + "/localModel/license",
                schemaPath: "#/$defs/localModel/properties/license/maxLength",
                keyword: "maxLength",
                params: { limit: 120 },
                message: "must NOT have more than 120 characters",
              };
              if (vErrors === null) {
                vErrors = [err77];
              } else {
                vErrors.push(err77);
              }
              errors++;
            }
            if (func2(data23) < 1) {
              const err78 = {
                instancePath: instancePath + "/localModel/license",
                schemaPath: "#/$defs/localModel/properties/license/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err78];
              } else {
                vErrors.push(err78);
              }
              errors++;
            }
          } else {
            const err79 = {
              instancePath: instancePath + "/localModel/license",
              schemaPath: "#/$defs/localModel/properties/license/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err79];
            } else {
              vErrors.push(err79);
            }
            errors++;
          }
        }
      } else {
        const err80 = {
          instancePath: instancePath + "/localModel",
          schemaPath: "#/$defs/localModel/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err80];
        } else {
          vErrors.push(err80);
        }
        errors++;
      }
    }
    if (data.createdAt !== void 0) {
      let data24 = data.createdAt;
      if (typeof data24 === "string") {
        if (!formats4.validate(data24)) {
          const err81 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err81];
          } else {
            vErrors.push(err81);
          }
          errors++;
        }
      } else {
        const err82 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err82];
        } else {
          vErrors.push(err82);
        }
        errors++;
      }
    }
    if (data.updatedAt !== void 0) {
      let data25 = data.updatedAt;
      if (typeof data25 === "string") {
        if (!formats4.validate(data25)) {
          const err83 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err83];
          } else {
            vErrors.push(err83);
          }
          errors++;
        }
      } else {
        const err84 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err84];
        } else {
          vErrors.push(err84);
        }
        errors++;
      }
    }
  } else {
    const err85 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err85];
    } else {
      vErrors.push(err85);
    }
    errors++;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var validateAiTaskSchema = validate23;
var schema38 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://financial-intelligence.local/schemas/ai-task.schema.json",
  title: "AI Task",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "task", "direction", "payload"],
  properties: {
    schemaVersion: { const: "1.0.0" },
    task: {
      enum: ["merchant.resolve.v1", "category.classify.v1", "query.plan.v1", "insight.word.v1"],
    },
    direction: { enum: ["request", "response"] },
    payload: { type: "object" },
  },
  allOf: [
    {
      if: {
        properties: { task: { const: "merchant.resolve.v1" }, direction: { const: "request" } },
        required: ["task", "direction"],
      },
      then: { properties: { payload: { $ref: "#/$defs/merchantResolveRequest" } } },
    },
    {
      if: {
        properties: { task: { const: "merchant.resolve.v1" }, direction: { const: "response" } },
        required: ["task", "direction"],
      },
      then: { properties: { payload: { $ref: "#/$defs/merchantResolveResponse" } } },
    },
    {
      if: {
        properties: { task: { const: "category.classify.v1" }, direction: { const: "request" } },
        required: ["task", "direction"],
      },
      then: { properties: { payload: { $ref: "#/$defs/categoryClassifyRequest" } } },
    },
    {
      if: {
        properties: { task: { const: "category.classify.v1" }, direction: { const: "response" } },
        required: ["task", "direction"],
      },
      then: { properties: { payload: { $ref: "#/$defs/categoryClassifyResponse" } } },
    },
    {
      if: {
        properties: { task: { const: "query.plan.v1" }, direction: { const: "request" } },
        required: ["task", "direction"],
      },
      then: { properties: { payload: { $ref: "#/$defs/queryPlanRequest" } } },
    },
    {
      if: {
        properties: { task: { const: "query.plan.v1" }, direction: { const: "response" } },
        required: ["task", "direction"],
      },
      then: { properties: { payload: { $ref: "#/$defs/queryPlanResponse" } } },
    },
    {
      if: {
        properties: { task: { const: "insight.word.v1" }, direction: { const: "request" } },
        required: ["task", "direction"],
      },
      then: { properties: { payload: { $ref: "#/$defs/insightWordRequest" } } },
    },
    {
      if: {
        properties: { task: { const: "insight.word.v1" }, direction: { const: "response" } },
        required: ["task", "direction"],
      },
      then: { properties: { payload: { $ref: "#/$defs/insightWordResponse" } } },
    },
  ],
  $defs: {
    confidence: { type: "number", minimum: 0, maximum: 1 },
    boundedText: { type: "string", minLength: 1, maxLength: 200 },
    evidenceCode: {
      enum: [
        "matched_alias",
        "similar_confirmed_merchant",
        "model_category_candidate",
        "insufficient_evidence",
      ],
    },
    categoryId: { type: "string", minLength: 1, maxLength: 80 },
    descriptionToken: { type: "string", minLength: 1, maxLength: 60 },
    merchantResolveRequest: {
      type: "object",
      additionalProperties: false,
      required: ["tokens"],
      properties: {
        tokens: {
          type: "array",
          minItems: 1,
          maxItems: 32,
          items: { $ref: "#/$defs/descriptionToken" },
        },
        countryHint: { type: "string", minLength: 2, maxLength: 2 },
        categoryHint: { $ref: "#/$defs/categoryId" },
      },
    },
    merchantResolveResponse: {
      type: "object",
      additionalProperties: false,
      required: ["label", "confidence", "evidence"],
      properties: {
        label: { $ref: "#/$defs/boundedText" },
        confidence: { $ref: "#/$defs/confidence" },
        evidence: {
          type: "array",
          minItems: 1,
          maxItems: 8,
          items: { $ref: "#/$defs/evidenceCode" },
        },
      },
    },
    categoryClassifyRequest: {
      type: "object",
      additionalProperties: false,
      required: ["descriptor", "direction", "allowedCategoryIds"],
      properties: {
        descriptor: { $ref: "#/$defs/boundedText" },
        direction: { enum: ["inflow", "outflow"] },
        allowedCategoryIds: {
          type: "array",
          minItems: 1,
          maxItems: 200,
          items: { $ref: "#/$defs/categoryId" },
        },
      },
    },
    categoryClassifyResponse: {
      type: "object",
      additionalProperties: false,
      required: ["categoryId", "confidence", "rationale"],
      properties: {
        categoryId: { $ref: "#/$defs/categoryId" },
        confidence: { $ref: "#/$defs/confidence" },
        rationale: { $ref: "#/$defs/boundedText" },
      },
    },
    queryPlanRequest: {
      type: "object",
      additionalProperties: false,
      required: ["question", "metrics", "dimensions"],
      properties: {
        question: { type: "string", minLength: 1, maxLength: 300 },
        metrics: {
          type: "array",
          minItems: 1,
          maxItems: 32,
          items: { $ref: "#/$defs/boundedText" },
        },
        dimensions: { type: "array", maxItems: 32, items: { $ref: "#/$defs/boundedText" } },
        dateRange: {
          type: "object",
          additionalProperties: false,
          required: ["from", "to"],
          properties: {
            from: { type: "string", format: "date" },
            to: { type: "string", format: "date" },
          },
        },
      },
    },
    queryPlanResponse: {
      type: "object",
      additionalProperties: false,
      required: ["metric", "dimensions"],
      properties: {
        metric: { $ref: "#/$defs/boundedText" },
        dimensions: { type: "array", maxItems: 8, items: { $ref: "#/$defs/boundedText" } },
        filters: { type: "array", maxItems: 16, items: { $ref: "#/$defs/boundedText" } },
        period: { $ref: "#/$defs/boundedText" },
        comparison: { $ref: "#/$defs/boundedText" },
        sort: { $ref: "#/$defs/boundedText" },
        limit: { type: "integer", minimum: 1, maximum: 1e3 },
      },
    },
    insightWordRequest: {
      type: "object",
      additionalProperties: false,
      required: ["facts"],
      properties: {
        facts: {
          type: "array",
          minItems: 1,
          maxItems: 32,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "value"],
            properties: {
              id: { $ref: "#/$defs/boundedText" },
              value: { $ref: "#/$defs/boundedText" },
            },
          },
        },
      },
    },
    insightWordResponse: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "factRefs"],
      properties: {
        summary: { type: "string", minLength: 1, maxLength: 500 },
        factRefs: {
          type: "array",
          minItems: 1,
          maxItems: 32,
          items: { $ref: "#/$defs/boundedText" },
        },
      },
    },
  },
};
function validate24(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.tokens === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "tokens" },
        message: "must have required property 'tokens'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "tokens" || key0 === "countryHint" || key0 === "categoryHint")) {
        const err1 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.tokens !== void 0) {
      let data0 = data.tokens;
      if (Array.isArray(data0)) {
        if (data0.length > 32) {
          const err2 = {
            instancePath: instancePath + "/tokens",
            schemaPath: "#/properties/tokens/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (data0.length < 1) {
          const err3 = {
            instancePath: instancePath + "/tokens",
            schemaPath: "#/properties/tokens/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data1 = data0[i0];
          if (typeof data1 === "string") {
            if (func2(data1) > 60) {
              const err4 = {
                instancePath: instancePath + "/tokens/" + i0,
                schemaPath: "#/$defs/descriptionToken/maxLength",
                keyword: "maxLength",
                params: { limit: 60 },
                message: "must NOT have more than 60 characters",
              };
              if (vErrors === null) {
                vErrors = [err4];
              } else {
                vErrors.push(err4);
              }
              errors++;
            }
            if (func2(data1) < 1) {
              const err5 = {
                instancePath: instancePath + "/tokens/" + i0,
                schemaPath: "#/$defs/descriptionToken/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err5];
              } else {
                vErrors.push(err5);
              }
              errors++;
            }
          } else {
            const err6 = {
              instancePath: instancePath + "/tokens/" + i0,
              schemaPath: "#/$defs/descriptionToken/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/tokens",
          schemaPath: "#/properties/tokens/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.countryHint !== void 0) {
      let data2 = data.countryHint;
      if (typeof data2 === "string") {
        if (func2(data2) > 2) {
          const err8 = {
            instancePath: instancePath + "/countryHint",
            schemaPath: "#/properties/countryHint/maxLength",
            keyword: "maxLength",
            params: { limit: 2 },
            message: "must NOT have more than 2 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func2(data2) < 2) {
          const err9 = {
            instancePath: instancePath + "/countryHint",
            schemaPath: "#/properties/countryHint/minLength",
            keyword: "minLength",
            params: { limit: 2 },
            message: "must NOT have fewer than 2 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/countryHint",
          schemaPath: "#/properties/countryHint/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.categoryHint !== void 0) {
      let data3 = data.categoryHint;
      if (typeof data3 === "string") {
        if (func2(data3) > 80) {
          const err11 = {
            instancePath: instancePath + "/categoryHint",
            schemaPath: "#/$defs/categoryId/maxLength",
            keyword: "maxLength",
            params: { limit: 80 },
            message: "must NOT have more than 80 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data3) < 1) {
          const err12 = {
            instancePath: instancePath + "/categoryHint",
            schemaPath: "#/$defs/categoryId/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/categoryHint",
          schemaPath: "#/$defs/categoryId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema45 = {
  enum: [
    "matched_alias",
    "similar_confirmed_merchant",
    "model_category_candidate",
    "insufficient_evidence",
  ],
};
function validate26(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate26.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.label === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "label" },
        message: "must have required property 'label'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.confidence === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "confidence" },
        message: "must have required property 'confidence'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.evidence === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "evidence" },
        message: "must have required property 'evidence'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "label" || key0 === "confidence" || key0 === "evidence")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.label !== void 0) {
      let data0 = data.label;
      if (typeof data0 === "string") {
        if (func2(data0) > 200) {
          const err4 = {
            instancePath: instancePath + "/label",
            schemaPath: "#/$defs/boundedText/maxLength",
            keyword: "maxLength",
            params: { limit: 200 },
            message: "must NOT have more than 200 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err5 = {
            instancePath: instancePath + "/label",
            schemaPath: "#/$defs/boundedText/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/label",
          schemaPath: "#/$defs/boundedText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.confidence !== void 0) {
      let data1 = data.confidence;
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 > 1 || isNaN(data1)) {
          const err7 = {
            instancePath: instancePath + "/confidence",
            schemaPath: "#/$defs/confidence/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 1 },
            message: "must be <= 1",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data1 < 0 || isNaN(data1)) {
          const err8 = {
            instancePath: instancePath + "/confidence",
            schemaPath: "#/$defs/confidence/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/confidence",
          schemaPath: "#/$defs/confidence/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.evidence !== void 0) {
      let data2 = data.evidence;
      if (Array.isArray(data2)) {
        if (data2.length > 8) {
          const err10 = {
            instancePath: instancePath + "/evidence",
            schemaPath: "#/properties/evidence/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (data2.length < 1) {
          const err11 = {
            instancePath: instancePath + "/evidence",
            schemaPath: "#/properties/evidence/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (!(
            data3 === "matched_alias" ||
            data3 === "similar_confirmed_merchant" ||
            data3 === "model_category_candidate" ||
            data3 === "insufficient_evidence"
          )) {
            const err12 = {
              instancePath: instancePath + "/evidence/" + i0,
              schemaPath: "#/$defs/evidenceCode/enum",
              keyword: "enum",
              params: { allowedValues: schema45.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/evidence",
          schemaPath: "#/properties/evidence/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate26.errors = vErrors;
  return errors === 0;
}
validate26.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema46 = {
  type: "object",
  additionalProperties: false,
  required: ["descriptor", "direction", "allowedCategoryIds"],
  properties: {
    descriptor: { $ref: "#/$defs/boundedText" },
    direction: { enum: ["inflow", "outflow"] },
    allowedCategoryIds: {
      type: "array",
      minItems: 1,
      maxItems: 200,
      items: { $ref: "#/$defs/categoryId" },
    },
  },
};
function validate28(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate28.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.descriptor === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "descriptor" },
        message: "must have required property 'descriptor'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.direction === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "direction" },
        message: "must have required property 'direction'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.allowedCategoryIds === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "allowedCategoryIds" },
        message: "must have required property 'allowedCategoryIds'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "descriptor" || key0 === "direction" || key0 === "allowedCategoryIds")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.descriptor !== void 0) {
      let data0 = data.descriptor;
      if (typeof data0 === "string") {
        if (func2(data0) > 200) {
          const err4 = {
            instancePath: instancePath + "/descriptor",
            schemaPath: "#/$defs/boundedText/maxLength",
            keyword: "maxLength",
            params: { limit: 200 },
            message: "must NOT have more than 200 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err5 = {
            instancePath: instancePath + "/descriptor",
            schemaPath: "#/$defs/boundedText/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/descriptor",
          schemaPath: "#/$defs/boundedText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.direction !== void 0) {
      let data1 = data.direction;
      if (!(data1 === "inflow" || data1 === "outflow")) {
        const err7 = {
          instancePath: instancePath + "/direction",
          schemaPath: "#/properties/direction/enum",
          keyword: "enum",
          params: { allowedValues: schema46.properties.direction.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.allowedCategoryIds !== void 0) {
      let data2 = data.allowedCategoryIds;
      if (Array.isArray(data2)) {
        if (data2.length > 200) {
          const err8 = {
            instancePath: instancePath + "/allowedCategoryIds",
            schemaPath: "#/properties/allowedCategoryIds/maxItems",
            keyword: "maxItems",
            params: { limit: 200 },
            message: "must NOT have more than 200 items",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (data2.length < 1) {
          const err9 = {
            instancePath: instancePath + "/allowedCategoryIds",
            schemaPath: "#/properties/allowedCategoryIds/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (typeof data3 === "string") {
            if (func2(data3) > 80) {
              const err10 = {
                instancePath: instancePath + "/allowedCategoryIds/" + i0,
                schemaPath: "#/$defs/categoryId/maxLength",
                keyword: "maxLength",
                params: { limit: 80 },
                message: "must NOT have more than 80 characters",
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
            if (func2(data3) < 1) {
              const err11 = {
                instancePath: instancePath + "/allowedCategoryIds/" + i0,
                schemaPath: "#/$defs/categoryId/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
          } else {
            const err12 = {
              instancePath: instancePath + "/allowedCategoryIds/" + i0,
              schemaPath: "#/$defs/categoryId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/allowedCategoryIds",
          schemaPath: "#/properties/allowedCategoryIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate28.errors = vErrors;
  return errors === 0;
}
validate28.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate30(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.categoryId === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "categoryId" },
        message: "must have required property 'categoryId'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.confidence === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "confidence" },
        message: "must have required property 'confidence'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.rationale === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "rationale" },
        message: "must have required property 'rationale'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "categoryId" || key0 === "confidence" || key0 === "rationale")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.categoryId !== void 0) {
      let data0 = data.categoryId;
      if (typeof data0 === "string") {
        if (func2(data0) > 80) {
          const err4 = {
            instancePath: instancePath + "/categoryId",
            schemaPath: "#/$defs/categoryId/maxLength",
            keyword: "maxLength",
            params: { limit: 80 },
            message: "must NOT have more than 80 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err5 = {
            instancePath: instancePath + "/categoryId",
            schemaPath: "#/$defs/categoryId/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/categoryId",
          schemaPath: "#/$defs/categoryId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.confidence !== void 0) {
      let data1 = data.confidence;
      if (typeof data1 == "number" && isFinite(data1)) {
        if (data1 > 1 || isNaN(data1)) {
          const err7 = {
            instancePath: instancePath + "/confidence",
            schemaPath: "#/$defs/confidence/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 1 },
            message: "must be <= 1",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data1 < 0 || isNaN(data1)) {
          const err8 = {
            instancePath: instancePath + "/confidence",
            schemaPath: "#/$defs/confidence/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/confidence",
          schemaPath: "#/$defs/confidence/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.rationale !== void 0) {
      let data2 = data.rationale;
      if (typeof data2 === "string") {
        if (func2(data2) > 200) {
          const err10 = {
            instancePath: instancePath + "/rationale",
            schemaPath: "#/$defs/boundedText/maxLength",
            keyword: "maxLength",
            params: { limit: 200 },
            message: "must NOT have more than 200 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err11 = {
            instancePath: instancePath + "/rationale",
            schemaPath: "#/$defs/boundedText/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/rationale",
          schemaPath: "#/$defs/boundedText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
  } else {
    const err13 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err13];
    } else {
      vErrors.push(err13);
    }
    errors++;
  }
  validate30.errors = vErrors;
  return errors === 0;
}
validate30.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var formats12 = require_formats().fullFormats.date;
function validate32(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate32.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.question === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "question" },
        message: "must have required property 'question'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.metrics === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "metrics" },
        message: "must have required property 'metrics'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.dimensions === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "dimensions" },
        message: "must have required property 'dimensions'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "question" ||
        key0 === "metrics" ||
        key0 === "dimensions" ||
        key0 === "dateRange"
      )) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.question !== void 0) {
      let data0 = data.question;
      if (typeof data0 === "string") {
        if (func2(data0) > 300) {
          const err4 = {
            instancePath: instancePath + "/question",
            schemaPath: "#/properties/question/maxLength",
            keyword: "maxLength",
            params: { limit: 300 },
            message: "must NOT have more than 300 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err5 = {
            instancePath: instancePath + "/question",
            schemaPath: "#/properties/question/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/question",
          schemaPath: "#/properties/question/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.metrics !== void 0) {
      let data1 = data.metrics;
      if (Array.isArray(data1)) {
        if (data1.length > 32) {
          const err7 = {
            instancePath: instancePath + "/metrics",
            schemaPath: "#/properties/metrics/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data1.length < 1) {
          const err8 = {
            instancePath: instancePath + "/metrics",
            schemaPath: "#/properties/metrics/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data2 = data1[i0];
          if (typeof data2 === "string") {
            if (func2(data2) > 200) {
              const err9 = {
                instancePath: instancePath + "/metrics/" + i0,
                schemaPath: "#/$defs/boundedText/maxLength",
                keyword: "maxLength",
                params: { limit: 200 },
                message: "must NOT have more than 200 characters",
              };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
            if (func2(data2) < 1) {
              const err10 = {
                instancePath: instancePath + "/metrics/" + i0,
                schemaPath: "#/$defs/boundedText/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
          } else {
            const err11 = {
              instancePath: instancePath + "/metrics/" + i0,
              schemaPath: "#/$defs/boundedText/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/metrics",
          schemaPath: "#/properties/metrics/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.dimensions !== void 0) {
      let data3 = data.dimensions;
      if (Array.isArray(data3)) {
        if (data3.length > 32) {
          const err13 = {
            instancePath: instancePath + "/dimensions",
            schemaPath: "#/properties/dimensions/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        const len1 = data3.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data4 = data3[i1];
          if (typeof data4 === "string") {
            if (func2(data4) > 200) {
              const err14 = {
                instancePath: instancePath + "/dimensions/" + i1,
                schemaPath: "#/$defs/boundedText/maxLength",
                keyword: "maxLength",
                params: { limit: 200 },
                message: "must NOT have more than 200 characters",
              };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
            if (func2(data4) < 1) {
              const err15 = {
                instancePath: instancePath + "/dimensions/" + i1,
                schemaPath: "#/$defs/boundedText/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
          } else {
            const err16 = {
              instancePath: instancePath + "/dimensions/" + i1,
              schemaPath: "#/$defs/boundedText/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/dimensions",
          schemaPath: "#/properties/dimensions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.dateRange !== void 0) {
      let data5 = data.dateRange;
      if (data5 && typeof data5 == "object" && !Array.isArray(data5)) {
        if (data5.from === void 0) {
          const err18 = {
            instancePath: instancePath + "/dateRange",
            schemaPath: "#/properties/dateRange/required",
            keyword: "required",
            params: { missingProperty: "from" },
            message: "must have required property 'from'",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (data5.to === void 0) {
          const err19 = {
            instancePath: instancePath + "/dateRange",
            schemaPath: "#/properties/dateRange/required",
            keyword: "required",
            params: { missingProperty: "to" },
            message: "must have required property 'to'",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        for (const key1 in data5) {
          if (!(key1 === "from" || key1 === "to")) {
            const err20 = {
              instancePath: instancePath + "/dateRange",
              schemaPath: "#/properties/dateRange/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
        if (data5.from !== void 0) {
          let data6 = data5.from;
          if (typeof data6 === "string") {
            if (!formats12.validate(data6)) {
              const err21 = {
                instancePath: instancePath + "/dateRange/from",
                schemaPath: "#/properties/dateRange/properties/from/format",
                keyword: "format",
                params: { format: "date" },
                message: 'must match format "date"',
              };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
          } else {
            const err22 = {
              instancePath: instancePath + "/dateRange/from",
              schemaPath: "#/properties/dateRange/properties/from/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data5.to !== void 0) {
          let data7 = data5.to;
          if (typeof data7 === "string") {
            if (!formats12.validate(data7)) {
              const err23 = {
                instancePath: instancePath + "/dateRange/to",
                schemaPath: "#/properties/dateRange/properties/to/format",
                keyword: "format",
                params: { format: "date" },
                message: 'must match format "date"',
              };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
          } else {
            const err24 = {
              instancePath: instancePath + "/dateRange/to",
              schemaPath: "#/properties/dateRange/properties/to/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
      } else {
        const err25 = {
          instancePath: instancePath + "/dateRange",
          schemaPath: "#/properties/dateRange/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
  } else {
    const err26 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err26];
    } else {
      vErrors.push(err26);
    }
    errors++;
  }
  validate32.errors = vErrors;
  return errors === 0;
}
validate32.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate34(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate34.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.metric === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "metric" },
        message: "must have required property 'metric'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.dimensions === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "dimensions" },
        message: "must have required property 'dimensions'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "metric" ||
        key0 === "dimensions" ||
        key0 === "filters" ||
        key0 === "period" ||
        key0 === "comparison" ||
        key0 === "sort" ||
        key0 === "limit"
      )) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.metric !== void 0) {
      let data0 = data.metric;
      if (typeof data0 === "string") {
        if (func2(data0) > 200) {
          const err3 = {
            instancePath: instancePath + "/metric",
            schemaPath: "#/$defs/boundedText/maxLength",
            keyword: "maxLength",
            params: { limit: 200 },
            message: "must NOT have more than 200 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err4 = {
            instancePath: instancePath + "/metric",
            schemaPath: "#/$defs/boundedText/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/metric",
          schemaPath: "#/$defs/boundedText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.dimensions !== void 0) {
      let data1 = data.dimensions;
      if (Array.isArray(data1)) {
        if (data1.length > 8) {
          const err6 = {
            instancePath: instancePath + "/dimensions",
            schemaPath: "#/properties/dimensions/maxItems",
            keyword: "maxItems",
            params: { limit: 8 },
            message: "must NOT have more than 8 items",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data2 = data1[i0];
          if (typeof data2 === "string") {
            if (func2(data2) > 200) {
              const err7 = {
                instancePath: instancePath + "/dimensions/" + i0,
                schemaPath: "#/$defs/boundedText/maxLength",
                keyword: "maxLength",
                params: { limit: 200 },
                message: "must NOT have more than 200 characters",
              };
              if (vErrors === null) {
                vErrors = [err7];
              } else {
                vErrors.push(err7);
              }
              errors++;
            }
            if (func2(data2) < 1) {
              const err8 = {
                instancePath: instancePath + "/dimensions/" + i0,
                schemaPath: "#/$defs/boundedText/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err8];
              } else {
                vErrors.push(err8);
              }
              errors++;
            }
          } else {
            const err9 = {
              instancePath: instancePath + "/dimensions/" + i0,
              schemaPath: "#/$defs/boundedText/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/dimensions",
          schemaPath: "#/properties/dimensions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.filters !== void 0) {
      let data3 = data.filters;
      if (Array.isArray(data3)) {
        if (data3.length > 16) {
          const err11 = {
            instancePath: instancePath + "/filters",
            schemaPath: "#/properties/filters/maxItems",
            keyword: "maxItems",
            params: { limit: 16 },
            message: "must NOT have more than 16 items",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        const len1 = data3.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data4 = data3[i1];
          if (typeof data4 === "string") {
            if (func2(data4) > 200) {
              const err12 = {
                instancePath: instancePath + "/filters/" + i1,
                schemaPath: "#/$defs/boundedText/maxLength",
                keyword: "maxLength",
                params: { limit: 200 },
                message: "must NOT have more than 200 characters",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
            if (func2(data4) < 1) {
              const err13 = {
                instancePath: instancePath + "/filters/" + i1,
                schemaPath: "#/$defs/boundedText/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          } else {
            const err14 = {
              instancePath: instancePath + "/filters/" + i1,
              schemaPath: "#/$defs/boundedText/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
      } else {
        const err15 = {
          instancePath: instancePath + "/filters",
          schemaPath: "#/properties/filters/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.period !== void 0) {
      let data5 = data.period;
      if (typeof data5 === "string") {
        if (func2(data5) > 200) {
          const err16 = {
            instancePath: instancePath + "/period",
            schemaPath: "#/$defs/boundedText/maxLength",
            keyword: "maxLength",
            params: { limit: 200 },
            message: "must NOT have more than 200 characters",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (func2(data5) < 1) {
          const err17 = {
            instancePath: instancePath + "/period",
            schemaPath: "#/$defs/boundedText/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/period",
          schemaPath: "#/$defs/boundedText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.comparison !== void 0) {
      let data6 = data.comparison;
      if (typeof data6 === "string") {
        if (func2(data6) > 200) {
          const err19 = {
            instancePath: instancePath + "/comparison",
            schemaPath: "#/$defs/boundedText/maxLength",
            keyword: "maxLength",
            params: { limit: 200 },
            message: "must NOT have more than 200 characters",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (func2(data6) < 1) {
          const err20 = {
            instancePath: instancePath + "/comparison",
            schemaPath: "#/$defs/boundedText/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/comparison",
          schemaPath: "#/$defs/boundedText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.sort !== void 0) {
      let data7 = data.sort;
      if (typeof data7 === "string") {
        if (func2(data7) > 200) {
          const err22 = {
            instancePath: instancePath + "/sort",
            schemaPath: "#/$defs/boundedText/maxLength",
            keyword: "maxLength",
            params: { limit: 200 },
            message: "must NOT have more than 200 characters",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (func2(data7) < 1) {
          const err23 = {
            instancePath: instancePath + "/sort",
            schemaPath: "#/$defs/boundedText/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/sort",
          schemaPath: "#/$defs/boundedText/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.limit !== void 0) {
      let data8 = data.limit;
      if (!(typeof data8 == "number" && !(data8 % 1) && !isNaN(data8) && isFinite(data8))) {
        const err25 = {
          instancePath: instancePath + "/limit",
          schemaPath: "#/properties/limit/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
      if (typeof data8 == "number" && isFinite(data8)) {
        if (data8 > 1e3 || isNaN(data8)) {
          const err26 = {
            instancePath: instancePath + "/limit",
            schemaPath: "#/properties/limit/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 1e3 },
            message: "must be <= 1000",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        if (data8 < 1 || isNaN(data8)) {
          const err27 = {
            instancePath: instancePath + "/limit",
            schemaPath: "#/properties/limit/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 1 },
            message: "must be >= 1",
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
      }
    }
  } else {
    const err28 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err28];
    } else {
      vErrors.push(err28);
    }
    errors++;
  }
  validate34.errors = vErrors;
  return errors === 0;
}
validate34.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate36(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate36.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.facts === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "facts" },
        message: "must have required property 'facts'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "facts")) {
        const err1 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.facts !== void 0) {
      let data0 = data.facts;
      if (Array.isArray(data0)) {
        if (data0.length > 32) {
          const err2 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err2];
          } else {
            vErrors.push(err2);
          }
          errors++;
        }
        if (data0.length < 1) {
          const err3 = {
            instancePath: instancePath + "/facts",
            schemaPath: "#/properties/facts/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data1 = data0[i0];
          if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
            if (data1.id === void 0) {
              const err4 = {
                instancePath: instancePath + "/facts/" + i0,
                schemaPath: "#/properties/facts/items/required",
                keyword: "required",
                params: { missingProperty: "id" },
                message: "must have required property 'id'",
              };
              if (vErrors === null) {
                vErrors = [err4];
              } else {
                vErrors.push(err4);
              }
              errors++;
            }
            if (data1.value === void 0) {
              const err5 = {
                instancePath: instancePath + "/facts/" + i0,
                schemaPath: "#/properties/facts/items/required",
                keyword: "required",
                params: { missingProperty: "value" },
                message: "must have required property 'value'",
              };
              if (vErrors === null) {
                vErrors = [err5];
              } else {
                vErrors.push(err5);
              }
              errors++;
            }
            for (const key1 in data1) {
              if (!(key1 === "id" || key1 === "value")) {
                const err6 = {
                  instancePath: instancePath + "/facts/" + i0,
                  schemaPath: "#/properties/facts/items/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err6];
                } else {
                  vErrors.push(err6);
                }
                errors++;
              }
            }
            if (data1.id !== void 0) {
              let data2 = data1.id;
              if (typeof data2 === "string") {
                if (func2(data2) > 200) {
                  const err7 = {
                    instancePath: instancePath + "/facts/" + i0 + "/id",
                    schemaPath: "#/$defs/boundedText/maxLength",
                    keyword: "maxLength",
                    params: { limit: 200 },
                    message: "must NOT have more than 200 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err7];
                  } else {
                    vErrors.push(err7);
                  }
                  errors++;
                }
                if (func2(data2) < 1) {
                  const err8 = {
                    instancePath: instancePath + "/facts/" + i0 + "/id",
                    schemaPath: "#/$defs/boundedText/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err8];
                  } else {
                    vErrors.push(err8);
                  }
                  errors++;
                }
              } else {
                const err9 = {
                  instancePath: instancePath + "/facts/" + i0 + "/id",
                  schemaPath: "#/$defs/boundedText/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err9];
                } else {
                  vErrors.push(err9);
                }
                errors++;
              }
            }
            if (data1.value !== void 0) {
              let data3 = data1.value;
              if (typeof data3 === "string") {
                if (func2(data3) > 200) {
                  const err10 = {
                    instancePath: instancePath + "/facts/" + i0 + "/value",
                    schemaPath: "#/$defs/boundedText/maxLength",
                    keyword: "maxLength",
                    params: { limit: 200 },
                    message: "must NOT have more than 200 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err10];
                  } else {
                    vErrors.push(err10);
                  }
                  errors++;
                }
                if (func2(data3) < 1) {
                  const err11 = {
                    instancePath: instancePath + "/facts/" + i0 + "/value",
                    schemaPath: "#/$defs/boundedText/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err11];
                  } else {
                    vErrors.push(err11);
                  }
                  errors++;
                }
              } else {
                const err12 = {
                  instancePath: instancePath + "/facts/" + i0 + "/value",
                  schemaPath: "#/$defs/boundedText/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err12];
                } else {
                  vErrors.push(err12);
                }
                errors++;
              }
            }
          } else {
            const err13 = {
              instancePath: instancePath + "/facts/" + i0,
              schemaPath: "#/properties/facts/items/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/facts",
          schemaPath: "#/properties/facts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
  } else {
    const err15 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  validate36.errors = vErrors;
  return errors === 0;
}
validate36.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate38(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate38.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.summary === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "summary" },
        message: "must have required property 'summary'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.factRefs === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "factRefs" },
        message: "must have required property 'factRefs'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "summary" || key0 === "factRefs")) {
        const err2 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.summary !== void 0) {
      let data0 = data.summary;
      if (typeof data0 === "string") {
        if (func2(data0) > 500) {
          const err3 = {
            instancePath: instancePath + "/summary",
            schemaPath: "#/properties/summary/maxLength",
            keyword: "maxLength",
            params: { limit: 500 },
            message: "must NOT have more than 500 characters",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
        if (func2(data0) < 1) {
          const err4 = {
            instancePath: instancePath + "/summary",
            schemaPath: "#/properties/summary/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/summary",
          schemaPath: "#/properties/summary/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.factRefs !== void 0) {
      let data1 = data.factRefs;
      if (Array.isArray(data1)) {
        if (data1.length > 32) {
          const err6 = {
            instancePath: instancePath + "/factRefs",
            schemaPath: "#/properties/factRefs/maxItems",
            keyword: "maxItems",
            params: { limit: 32 },
            message: "must NOT have more than 32 items",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (data1.length < 1) {
          const err7 = {
            instancePath: instancePath + "/factRefs",
            schemaPath: "#/properties/factRefs/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data2 = data1[i0];
          if (typeof data2 === "string") {
            if (func2(data2) > 200) {
              const err8 = {
                instancePath: instancePath + "/factRefs/" + i0,
                schemaPath: "#/$defs/boundedText/maxLength",
                keyword: "maxLength",
                params: { limit: 200 },
                message: "must NOT have more than 200 characters",
              };
              if (vErrors === null) {
                vErrors = [err8];
              } else {
                vErrors.push(err8);
              }
              errors++;
            }
            if (func2(data2) < 1) {
              const err9 = {
                instancePath: instancePath + "/factRefs/" + i0,
                schemaPath: "#/$defs/boundedText/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
          } else {
            const err10 = {
              instancePath: instancePath + "/factRefs/" + i0,
              schemaPath: "#/$defs/boundedText/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
        }
      } else {
        const err11 = {
          instancePath: instancePath + "/factRefs",
          schemaPath: "#/properties/factRefs/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
  } else {
    const err12 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err12];
    } else {
      vErrors.push(err12);
    }
    errors++;
  }
  validate38.errors = vErrors;
  return errors === 0;
}
validate38.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate23(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  const _errs2 = errors;
  let valid1 = true;
  const _errs3 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if (
      (data.task === void 0 && (missing0 = "task")) ||
      (data.direction === void 0 && (missing0 = "direction"))
    ) {
      const err0 = {};
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    } else {
      if (data.task !== void 0) {
        const _errs4 = errors;
        if ("merchant.resolve.v1" !== data.task) {
          const err1 = {};
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
        var valid2 = _errs4 === errors;
      } else {
        var valid2 = true;
      }
      if (valid2) {
        if (data.direction !== void 0) {
          const _errs5 = errors;
          if ("request" !== data.direction) {
            const err2 = {};
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
          var valid2 = _errs5 === errors;
        } else {
          var valid2 = true;
        }
      }
    }
  }
  var _valid0 = _errs3 === errors;
  errors = _errs2;
  if (vErrors !== null) {
    if (_errs2) {
      vErrors.length = _errs2;
    } else {
      vErrors = null;
    }
  }
  if (_valid0) {
    const _errs6 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.payload !== void 0) {
        if (
          !validate24(data.payload, {
            instancePath: instancePath + "/payload",
            parentData: data,
            parentDataProperty: "payload",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid0 = _errs6 === errors;
    valid1 = _valid0;
    if (valid1) {
      var props0 = {};
      props0.payload = true;
      props0.task = true;
      props0.direction = true;
    }
  }
  if (!valid1) {
    const err3 = {
      instancePath,
      schemaPath: "#/allOf/0/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err3];
    } else {
      vErrors.push(err3);
    }
    errors++;
  }
  const _errs9 = errors;
  let valid4 = true;
  const _errs10 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing1;
    if (
      (data.task === void 0 && (missing1 = "task")) ||
      (data.direction === void 0 && (missing1 = "direction"))
    ) {
      const err4 = {};
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    } else {
      if (data.task !== void 0) {
        const _errs11 = errors;
        if ("merchant.resolve.v1" !== data.task) {
          const err5 = {};
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
        var valid5 = _errs11 === errors;
      } else {
        var valid5 = true;
      }
      if (valid5) {
        if (data.direction !== void 0) {
          const _errs12 = errors;
          if ("response" !== data.direction) {
            const err6 = {};
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
          var valid5 = _errs12 === errors;
        } else {
          var valid5 = true;
        }
      }
    }
  }
  var _valid1 = _errs10 === errors;
  errors = _errs9;
  if (vErrors !== null) {
    if (_errs9) {
      vErrors.length = _errs9;
    } else {
      vErrors = null;
    }
  }
  if (_valid1) {
    const _errs13 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.payload !== void 0) {
        if (
          !validate26(data.payload, {
            instancePath: instancePath + "/payload",
            parentData: data,
            parentDataProperty: "payload",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate26.errors : vErrors.concat(validate26.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid1 = _errs13 === errors;
    valid4 = _valid1;
    if (valid4) {
      var props1 = {};
      props1.payload = true;
      props1.task = true;
      props1.direction = true;
    }
  }
  if (!valid4) {
    const err7 = {
      instancePath,
      schemaPath: "#/allOf/1/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  if (props0 !== true && props1 !== void 0) {
    if (props1 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props1);
    }
  }
  const _errs16 = errors;
  let valid7 = true;
  const _errs17 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing2;
    if (
      (data.task === void 0 && (missing2 = "task")) ||
      (data.direction === void 0 && (missing2 = "direction"))
    ) {
      const err8 = {};
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    } else {
      if (data.task !== void 0) {
        const _errs18 = errors;
        if ("category.classify.v1" !== data.task) {
          const err9 = {};
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        var valid8 = _errs18 === errors;
      } else {
        var valid8 = true;
      }
      if (valid8) {
        if (data.direction !== void 0) {
          const _errs19 = errors;
          if ("request" !== data.direction) {
            const err10 = {};
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
          var valid8 = _errs19 === errors;
        } else {
          var valid8 = true;
        }
      }
    }
  }
  var _valid2 = _errs17 === errors;
  errors = _errs16;
  if (vErrors !== null) {
    if (_errs16) {
      vErrors.length = _errs16;
    } else {
      vErrors = null;
    }
  }
  if (_valid2) {
    const _errs20 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.payload !== void 0) {
        if (
          !validate28(data.payload, {
            instancePath: instancePath + "/payload",
            parentData: data,
            parentDataProperty: "payload",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid2 = _errs20 === errors;
    valid7 = _valid2;
    if (valid7) {
      var props2 = {};
      props2.payload = true;
      props2.task = true;
      props2.direction = true;
    }
  }
  if (!valid7) {
    const err11 = {
      instancePath,
      schemaPath: "#/allOf/2/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err11];
    } else {
      vErrors.push(err11);
    }
    errors++;
  }
  if (props0 !== true && props2 !== void 0) {
    if (props2 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props2);
    }
  }
  const _errs23 = errors;
  let valid10 = true;
  const _errs24 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing3;
    if (
      (data.task === void 0 && (missing3 = "task")) ||
      (data.direction === void 0 && (missing3 = "direction"))
    ) {
      const err12 = {};
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    } else {
      if (data.task !== void 0) {
        const _errs25 = errors;
        if ("category.classify.v1" !== data.task) {
          const err13 = {};
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        var valid11 = _errs25 === errors;
      } else {
        var valid11 = true;
      }
      if (valid11) {
        if (data.direction !== void 0) {
          const _errs26 = errors;
          if ("response" !== data.direction) {
            const err14 = {};
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
          var valid11 = _errs26 === errors;
        } else {
          var valid11 = true;
        }
      }
    }
  }
  var _valid3 = _errs24 === errors;
  errors = _errs23;
  if (vErrors !== null) {
    if (_errs23) {
      vErrors.length = _errs23;
    } else {
      vErrors = null;
    }
  }
  if (_valid3) {
    const _errs27 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.payload !== void 0) {
        if (
          !validate30(data.payload, {
            instancePath: instancePath + "/payload",
            parentData: data,
            parentDataProperty: "payload",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid3 = _errs27 === errors;
    valid10 = _valid3;
    if (valid10) {
      var props3 = {};
      props3.payload = true;
      props3.task = true;
      props3.direction = true;
    }
  }
  if (!valid10) {
    const err15 = {
      instancePath,
      schemaPath: "#/allOf/3/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err15];
    } else {
      vErrors.push(err15);
    }
    errors++;
  }
  if (props0 !== true && props3 !== void 0) {
    if (props3 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props3);
    }
  }
  const _errs30 = errors;
  let valid13 = true;
  const _errs31 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing4;
    if (
      (data.task === void 0 && (missing4 = "task")) ||
      (data.direction === void 0 && (missing4 = "direction"))
    ) {
      const err16 = {};
      if (vErrors === null) {
        vErrors = [err16];
      } else {
        vErrors.push(err16);
      }
      errors++;
    } else {
      if (data.task !== void 0) {
        const _errs32 = errors;
        if ("query.plan.v1" !== data.task) {
          const err17 = {};
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        var valid14 = _errs32 === errors;
      } else {
        var valid14 = true;
      }
      if (valid14) {
        if (data.direction !== void 0) {
          const _errs33 = errors;
          if ("request" !== data.direction) {
            const err18 = {};
            if (vErrors === null) {
              vErrors = [err18];
            } else {
              vErrors.push(err18);
            }
            errors++;
          }
          var valid14 = _errs33 === errors;
        } else {
          var valid14 = true;
        }
      }
    }
  }
  var _valid4 = _errs31 === errors;
  errors = _errs30;
  if (vErrors !== null) {
    if (_errs30) {
      vErrors.length = _errs30;
    } else {
      vErrors = null;
    }
  }
  if (_valid4) {
    const _errs34 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.payload !== void 0) {
        if (
          !validate32(data.payload, {
            instancePath: instancePath + "/payload",
            parentData: data,
            parentDataProperty: "payload",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate32.errors : vErrors.concat(validate32.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid4 = _errs34 === errors;
    valid13 = _valid4;
    if (valid13) {
      var props4 = {};
      props4.payload = true;
      props4.task = true;
      props4.direction = true;
    }
  }
  if (!valid13) {
    const err19 = {
      instancePath,
      schemaPath: "#/allOf/4/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err19];
    } else {
      vErrors.push(err19);
    }
    errors++;
  }
  if (props0 !== true && props4 !== void 0) {
    if (props4 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props4);
    }
  }
  const _errs37 = errors;
  let valid16 = true;
  const _errs38 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing5;
    if (
      (data.task === void 0 && (missing5 = "task")) ||
      (data.direction === void 0 && (missing5 = "direction"))
    ) {
      const err20 = {};
      if (vErrors === null) {
        vErrors = [err20];
      } else {
        vErrors.push(err20);
      }
      errors++;
    } else {
      if (data.task !== void 0) {
        const _errs39 = errors;
        if ("query.plan.v1" !== data.task) {
          const err21 = {};
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        var valid17 = _errs39 === errors;
      } else {
        var valid17 = true;
      }
      if (valid17) {
        if (data.direction !== void 0) {
          const _errs40 = errors;
          if ("response" !== data.direction) {
            const err22 = {};
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
          var valid17 = _errs40 === errors;
        } else {
          var valid17 = true;
        }
      }
    }
  }
  var _valid5 = _errs38 === errors;
  errors = _errs37;
  if (vErrors !== null) {
    if (_errs37) {
      vErrors.length = _errs37;
    } else {
      vErrors = null;
    }
  }
  if (_valid5) {
    const _errs41 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.payload !== void 0) {
        if (
          !validate34(data.payload, {
            instancePath: instancePath + "/payload",
            parentData: data,
            parentDataProperty: "payload",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate34.errors : vErrors.concat(validate34.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid5 = _errs41 === errors;
    valid16 = _valid5;
    if (valid16) {
      var props5 = {};
      props5.payload = true;
      props5.task = true;
      props5.direction = true;
    }
  }
  if (!valid16) {
    const err23 = {
      instancePath,
      schemaPath: "#/allOf/5/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  if (props0 !== true && props5 !== void 0) {
    if (props5 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props5);
    }
  }
  const _errs44 = errors;
  let valid19 = true;
  const _errs45 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing6;
    if (
      (data.task === void 0 && (missing6 = "task")) ||
      (data.direction === void 0 && (missing6 = "direction"))
    ) {
      const err24 = {};
      if (vErrors === null) {
        vErrors = [err24];
      } else {
        vErrors.push(err24);
      }
      errors++;
    } else {
      if (data.task !== void 0) {
        const _errs46 = errors;
        if ("insight.word.v1" !== data.task) {
          const err25 = {};
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        var valid20 = _errs46 === errors;
      } else {
        var valid20 = true;
      }
      if (valid20) {
        if (data.direction !== void 0) {
          const _errs47 = errors;
          if ("request" !== data.direction) {
            const err26 = {};
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
          var valid20 = _errs47 === errors;
        } else {
          var valid20 = true;
        }
      }
    }
  }
  var _valid6 = _errs45 === errors;
  errors = _errs44;
  if (vErrors !== null) {
    if (_errs44) {
      vErrors.length = _errs44;
    } else {
      vErrors = null;
    }
  }
  if (_valid6) {
    const _errs48 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.payload !== void 0) {
        if (
          !validate36(data.payload, {
            instancePath: instancePath + "/payload",
            parentData: data,
            parentDataProperty: "payload",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate36.errors : vErrors.concat(validate36.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid6 = _errs48 === errors;
    valid19 = _valid6;
    if (valid19) {
      var props6 = {};
      props6.payload = true;
      props6.task = true;
      props6.direction = true;
    }
  }
  if (!valid19) {
    const err27 = {
      instancePath,
      schemaPath: "#/allOf/6/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err27];
    } else {
      vErrors.push(err27);
    }
    errors++;
  }
  if (props0 !== true && props6 !== void 0) {
    if (props6 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props6);
    }
  }
  const _errs51 = errors;
  let valid22 = true;
  const _errs52 = errors;
  if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing7;
    if (
      (data.task === void 0 && (missing7 = "task")) ||
      (data.direction === void 0 && (missing7 = "direction"))
    ) {
      const err28 = {};
      if (vErrors === null) {
        vErrors = [err28];
      } else {
        vErrors.push(err28);
      }
      errors++;
    } else {
      if (data.task !== void 0) {
        const _errs53 = errors;
        if ("insight.word.v1" !== data.task) {
          const err29 = {};
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
        var valid23 = _errs53 === errors;
      } else {
        var valid23 = true;
      }
      if (valid23) {
        if (data.direction !== void 0) {
          const _errs54 = errors;
          if ("response" !== data.direction) {
            const err30 = {};
            if (vErrors === null) {
              vErrors = [err30];
            } else {
              vErrors.push(err30);
            }
            errors++;
          }
          var valid23 = _errs54 === errors;
        } else {
          var valid23 = true;
        }
      }
    }
  }
  var _valid7 = _errs52 === errors;
  errors = _errs51;
  if (vErrors !== null) {
    if (_errs51) {
      vErrors.length = _errs51;
    } else {
      vErrors = null;
    }
  }
  if (_valid7) {
    const _errs55 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
      if (data.payload !== void 0) {
        if (
          !validate38(data.payload, {
            instancePath: instancePath + "/payload",
            parentData: data,
            parentDataProperty: "payload",
            rootData,
            dynamicAnchors,
          })
        ) {
          vErrors = vErrors === null ? validate38.errors : vErrors.concat(validate38.errors);
          errors = vErrors.length;
        }
      }
    }
    var _valid7 = _errs55 === errors;
    valid22 = _valid7;
    if (valid22) {
      var props7 = {};
      props7.payload = true;
      props7.task = true;
      props7.direction = true;
    }
  }
  if (!valid22) {
    const err31 = {
      instancePath,
      schemaPath: "#/allOf/7/if",
      keyword: "if",
      params: { failingKeyword: "then" },
      message: 'must match "then" schema',
    };
    if (vErrors === null) {
      vErrors = [err31];
    } else {
      vErrors.push(err31);
    }
    errors++;
  }
  if (props0 !== true && props7 !== void 0) {
    if (props7 === true) {
      props0 = true;
    } else {
      props0 = props0 || {};
      Object.assign(props0, props7);
    }
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err32 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property 'schemaVersion'",
      };
      if (vErrors === null) {
        vErrors = [err32];
      } else {
        vErrors.push(err32);
      }
      errors++;
    }
    if (data.task === void 0) {
      const err33 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "task" },
        message: "must have required property 'task'",
      };
      if (vErrors === null) {
        vErrors = [err33];
      } else {
        vErrors.push(err33);
      }
      errors++;
    }
    if (data.direction === void 0) {
      const err34 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "direction" },
        message: "must have required property 'direction'",
      };
      if (vErrors === null) {
        vErrors = [err34];
      } else {
        vErrors.push(err34);
      }
      errors++;
    }
    if (data.payload === void 0) {
      const err35 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "payload" },
        message: "must have required property 'payload'",
      };
      if (vErrors === null) {
        vErrors = [err35];
      } else {
        vErrors.push(err35);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "schemaVersion" ||
        key0 === "task" ||
        key0 === "direction" ||
        key0 === "payload"
      )) {
        const err36 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      if ("1.0.0" !== data.schemaVersion) {
        const err37 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "1.0.0" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.task !== void 0) {
      let data25 = data.task;
      if (!(
        data25 === "merchant.resolve.v1" ||
        data25 === "category.classify.v1" ||
        data25 === "query.plan.v1" ||
        data25 === "insight.word.v1"
      )) {
        const err38 = {
          instancePath: instancePath + "/task",
          schemaPath: "#/properties/task/enum",
          keyword: "enum",
          params: { allowedValues: schema38.properties.task.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.direction !== void 0) {
      let data26 = data.direction;
      if (!(data26 === "request" || data26 === "response")) {
        const err39 = {
          instancePath: instancePath + "/direction",
          schemaPath: "#/properties/direction/enum",
          keyword: "enum",
          params: { allowedValues: schema38.properties.direction.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.payload !== void 0) {
      let data27 = data.payload;
      if (!(data27 && typeof data27 == "object" && !Array.isArray(data27))) {
        const err40 = {
          instancePath: instancePath + "/payload",
          schemaPath: "#/properties/payload/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
  } else {
    const err41 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err41];
    } else {
      vErrors.push(err41);
    }
    errors++;
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var validateCategorySchema = validate40;
var schema68 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://financial-intelligence.local/schemas/category.schema.json",
  title: "Category",
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "kind", "order", "archived", "createdAt", "updatedAt"],
  properties: {
    id: { $ref: "#/$defs/uuid" },
    name: { type: "string", minLength: 1, maxLength: 120 },
    parentId: { $ref: "#/$defs/uuid" },
    kind: { enum: ["income", "expense", "transfer", "other"] },
    icon: { type: "string", minLength: 1, maxLength: 80 },
    color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    order: { type: "integer", minimum: 0 },
    archived: { type: "boolean" },
    createdAt: { $ref: "#/$defs/dateTime" },
    updatedAt: { $ref: "#/$defs/dateTime" },
  },
  $defs: {
    uuid: { type: "string", format: "uuid" },
    dateTime: { type: "string", format: "date-time" },
  },
};
var pattern6 = new RegExp("^#[0-9A-Fa-f]{6}$", "u");
function validate40(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate40.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.name === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.kind === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "kind" },
        message: "must have required property 'kind'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.order === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "order" },
        message: "must have required property 'order'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.archived === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "archived" },
        message: "must have required property 'archived'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema68.properties, key0)) {
        const err7 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!formats0.test(data0)) {
          const err8 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data1 = data.name;
      if (typeof data1 === "string") {
        if (func2(data1) > 120) {
          const err10 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/maxLength",
            keyword: "maxLength",
            params: { limit: 120 },
            message: "must NOT have more than 120 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err11 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.parentId !== void 0) {
      let data2 = data.parentId;
      if (typeof data2 === "string") {
        if (!formats0.test(data2)) {
          const err13 = {
            instancePath: instancePath + "/parentId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/parentId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.kind !== void 0) {
      let data3 = data.kind;
      if (!(
        data3 === "income" ||
        data3 === "expense" ||
        data3 === "transfer" ||
        data3 === "other"
      )) {
        const err15 = {
          instancePath: instancePath + "/kind",
          schemaPath: "#/properties/kind/enum",
          keyword: "enum",
          params: { allowedValues: schema68.properties.kind.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.icon !== void 0) {
      let data4 = data.icon;
      if (typeof data4 === "string") {
        if (func2(data4) > 80) {
          const err16 = {
            instancePath: instancePath + "/icon",
            schemaPath: "#/properties/icon/maxLength",
            keyword: "maxLength",
            params: { limit: 80 },
            message: "must NOT have more than 80 characters",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
        if (func2(data4) < 1) {
          const err17 = {
            instancePath: instancePath + "/icon",
            schemaPath: "#/properties/icon/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/icon",
          schemaPath: "#/properties/icon/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.color !== void 0) {
      let data5 = data.color;
      if (typeof data5 === "string") {
        if (!pattern6.test(data5)) {
          const err19 = {
            instancePath: instancePath + "/color",
            schemaPath: "#/properties/color/pattern",
            keyword: "pattern",
            params: { pattern: "^#[0-9A-Fa-f]{6}$" },
            message: 'must match pattern "^#[0-9A-Fa-f]{6}$"',
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/color",
          schemaPath: "#/properties/color/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.order !== void 0) {
      let data6 = data.order;
      if (!(typeof data6 == "number" && !(data6 % 1) && !isNaN(data6) && isFinite(data6))) {
        const err21 = {
          instancePath: instancePath + "/order",
          schemaPath: "#/properties/order/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
      if (typeof data6 == "number" && isFinite(data6)) {
        if (data6 < 0 || isNaN(data6)) {
          const err22 = {
            instancePath: instancePath + "/order",
            schemaPath: "#/properties/order/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      }
    }
    if (data.archived !== void 0) {
      if (typeof data.archived !== "boolean") {
        const err23 = {
          instancePath: instancePath + "/archived",
          schemaPath: "#/properties/archived/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.createdAt !== void 0) {
      let data8 = data.createdAt;
      if (typeof data8 === "string") {
        if (!formats4.validate(data8)) {
          const err24 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
      } else {
        const err25 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
    if (data.updatedAt !== void 0) {
      let data9 = data.updatedAt;
      if (typeof data9 === "string") {
        if (!formats4.validate(data9)) {
          const err26 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
  } else {
    const err28 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err28];
    } else {
      vErrors.push(err28);
    }
    errors++;
  }
  validate40.errors = vErrors;
  return errors === 0;
}
validate40.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var validateDashboardSchema = validate41;
var pattern7 = new RegExp("^[A-Z]{3}$", "u");
function validate42(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate42.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(
        key0 === "dateFrom" ||
        key0 === "dateTo" ||
        key0 === "accountIds" ||
        key0 === "categoryIds" ||
        key0 === "merchantIds" ||
        key0 === "tags" ||
        key0 === "currency" ||
        key0 === "excludeTransfers"
      )) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.dateFrom !== void 0) {
      let data0 = data.dateFrom;
      if (typeof data0 === "string") {
        if (!formats12.validate(data0)) {
          const err1 = {
            instancePath: instancePath + "/dateFrom",
            schemaPath: "#/$defs/date/format",
            keyword: "format",
            params: { format: "date" },
            message: 'must match format "date"',
          };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = {
          instancePath: instancePath + "/dateFrom",
          schemaPath: "#/$defs/date/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.dateTo !== void 0) {
      let data1 = data.dateTo;
      if (typeof data1 === "string") {
        if (!formats12.validate(data1)) {
          const err3 = {
            instancePath: instancePath + "/dateTo",
            schemaPath: "#/$defs/date/format",
            keyword: "format",
            params: { format: "date" },
            message: 'must match format "date"',
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      } else {
        const err4 = {
          instancePath: instancePath + "/dateTo",
          schemaPath: "#/$defs/date/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.accountIds !== void 0) {
      let data2 = data.accountIds;
      if (Array.isArray(data2)) {
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data3 = data2[i0];
          if (typeof data3 === "string") {
            if (!formats0.test(data3)) {
              const err5 = {
                instancePath: instancePath + "/accountIds/" + i0,
                schemaPath: "#/$defs/uuid/format",
                keyword: "format",
                params: { format: "uuid" },
                message: 'must match format "uuid"',
              };
              if (vErrors === null) {
                vErrors = [err5];
              } else {
                vErrors.push(err5);
              }
              errors++;
            }
          } else {
            const err6 = {
              instancePath: instancePath + "/accountIds/" + i0,
              schemaPath: "#/$defs/uuid/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
        let i1 = data2.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data2[i1], data2[j0])) {
                const err7 = {
                  instancePath: instancePath + "/accountIds",
                  schemaPath: "#/properties/accountIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err7];
                } else {
                  vErrors.push(err7);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/accountIds",
          schemaPath: "#/properties/accountIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.categoryIds !== void 0) {
      let data4 = data.categoryIds;
      if (Array.isArray(data4)) {
        const len1 = data4.length;
        for (let i2 = 0; i2 < len1; i2++) {
          let data5 = data4[i2];
          if (typeof data5 === "string") {
            if (!formats0.test(data5)) {
              const err9 = {
                instancePath: instancePath + "/categoryIds/" + i2,
                schemaPath: "#/$defs/uuid/format",
                keyword: "format",
                params: { format: "uuid" },
                message: 'must match format "uuid"',
              };
              if (vErrors === null) {
                vErrors = [err9];
              } else {
                vErrors.push(err9);
              }
              errors++;
            }
          } else {
            const err10 = {
              instancePath: instancePath + "/categoryIds/" + i2,
              schemaPath: "#/$defs/uuid/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
        }
        let i3 = data4.length;
        let j1;
        if (i3 > 1) {
          outer1: for (; i3--;) {
            for (j1 = i3; j1--;) {
              if (func0(data4[i3], data4[j1])) {
                const err11 = {
                  instancePath: instancePath + "/categoryIds",
                  schemaPath: "#/properties/categoryIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i3, j: j1 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j1 +
                    " and " +
                    i3 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err11];
                } else {
                  vErrors.push(err11);
                }
                errors++;
                break outer1;
              }
            }
          }
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/categoryIds",
          schemaPath: "#/properties/categoryIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.merchantIds !== void 0) {
      let data6 = data.merchantIds;
      if (Array.isArray(data6)) {
        const len2 = data6.length;
        for (let i4 = 0; i4 < len2; i4++) {
          let data7 = data6[i4];
          if (typeof data7 === "string") {
            if (!formats0.test(data7)) {
              const err13 = {
                instancePath: instancePath + "/merchantIds/" + i4,
                schemaPath: "#/$defs/uuid/format",
                keyword: "format",
                params: { format: "uuid" },
                message: 'must match format "uuid"',
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          } else {
            const err14 = {
              instancePath: instancePath + "/merchantIds/" + i4,
              schemaPath: "#/$defs/uuid/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
        let i5 = data6.length;
        let j2;
        if (i5 > 1) {
          outer2: for (; i5--;) {
            for (j2 = i5; j2--;) {
              if (func0(data6[i5], data6[j2])) {
                const err15 = {
                  instancePath: instancePath + "/merchantIds",
                  schemaPath: "#/properties/merchantIds/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i5, j: j2 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j2 +
                    " and " +
                    i5 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err15];
                } else {
                  vErrors.push(err15);
                }
                errors++;
                break outer2;
              }
            }
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/merchantIds",
          schemaPath: "#/properties/merchantIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.tags !== void 0) {
      let data8 = data.tags;
      if (Array.isArray(data8)) {
        const len3 = data8.length;
        for (let i6 = 0; i6 < len3; i6++) {
          let data9 = data8[i6];
          if (typeof data9 === "string") {
            if (func2(data9) > 60) {
              const err17 = {
                instancePath: instancePath + "/tags/" + i6,
                schemaPath: "#/properties/tags/items/maxLength",
                keyword: "maxLength",
                params: { limit: 60 },
                message: "must NOT have more than 60 characters",
              };
              if (vErrors === null) {
                vErrors = [err17];
              } else {
                vErrors.push(err17);
              }
              errors++;
            }
            if (func2(data9) < 1) {
              const err18 = {
                instancePath: instancePath + "/tags/" + i6,
                schemaPath: "#/properties/tags/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
          } else {
            const err19 = {
              instancePath: instancePath + "/tags/" + i6,
              schemaPath: "#/properties/tags/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err19];
            } else {
              vErrors.push(err19);
            }
            errors++;
          }
        }
        let i7 = data8.length;
        let j3;
        if (i7 > 1) {
          const indices0 = {};
          for (; i7--;) {
            let item0 = data8[i7];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j3 = indices0[item0];
              const err20 = {
                instancePath: instancePath + "/tags",
                schemaPath: "#/properties/tags/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i7, j: j3 },
                message:
                  "must NOT have duplicate items (items ## " +
                  j3 +
                  " and " +
                  i7 +
                  " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
              break;
            }
            indices0[item0] = i7;
          }
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/tags",
          schemaPath: "#/properties/tags/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.currency !== void 0) {
      let data10 = data.currency;
      if (typeof data10 === "string") {
        if (!pattern7.test(data10)) {
          const err22 = {
            instancePath: instancePath + "/currency",
            schemaPath: "#/properties/currency/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Z]{3}$" },
            message: 'must match pattern "^[A-Z]{3}$"',
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/currency",
          schemaPath: "#/properties/currency/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.excludeTransfers !== void 0) {
      if (typeof data.excludeTransfers !== "boolean") {
        const err24 = {
          instancePath: instancePath + "/excludeTransfers",
          schemaPath: "#/properties/excludeTransfers/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
  } else {
    const err25 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err25];
    } else {
      vErrors.push(err25);
    }
    errors++;
  }
  validate42.errors = vErrors;
  return errors === 0;
}
validate42.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema81 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "type", "title", "query", "layout", "showTableAlternative"],
  properties: {
    id: { $ref: "#/$defs/uuid" },
    type: {
      enum: [
        "metric",
        "timeSeries",
        "categoryBreakdown",
        "merchantRanking",
        "moneyFlow",
        "calendarHeatmap",
        "recurringList",
        "table",
      ],
    },
    title: { type: "string", minLength: 1, maxLength: 120 },
    query: {
      type: "object",
      additionalProperties: false,
      required: ["metric"],
      properties: {
        metric: { enum: ["income", "spending", "netCashFlow", "transactionCount", "savingsRate"] },
        dimension: { enum: ["month", "category", "merchant", "account", "day"] },
        limit: { type: "integer", minimum: 1, maximum: 1e3 },
        sort: { enum: ["valueAsc", "valueDesc", "labelAsc", "labelDesc", "dateAsc", "dateDesc"] },
      },
    },
    layout: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y", "width", "height"],
      properties: {
        x: { type: "integer", minimum: 0 },
        y: { type: "integer", minimum: 0 },
        width: { type: "integer", minimum: 1, maximum: 12 },
        height: { type: "integer", minimum: 1, maximum: 20 },
      },
    },
    showTableAlternative: { const: true },
  },
};
function validate44(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate44.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.type === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "type" },
        message: "must have required property 'type'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.title === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "title" },
        message: "must have required property 'title'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.query === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "query" },
        message: "must have required property 'query'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.layout === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "layout" },
        message: "must have required property 'layout'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.showTableAlternative === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "showTableAlternative" },
        message: "must have required property 'showTableAlternative'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "id" ||
        key0 === "type" ||
        key0 === "title" ||
        key0 === "query" ||
        key0 === "layout" ||
        key0 === "showTableAlternative"
      )) {
        const err6 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!formats0.test(data0)) {
          const err7 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.type !== void 0) {
      let data1 = data.type;
      if (!(
        data1 === "metric" ||
        data1 === "timeSeries" ||
        data1 === "categoryBreakdown" ||
        data1 === "merchantRanking" ||
        data1 === "moneyFlow" ||
        data1 === "calendarHeatmap" ||
        data1 === "recurringList" ||
        data1 === "table"
      )) {
        const err9 = {
          instancePath: instancePath + "/type",
          schemaPath: "#/properties/type/enum",
          keyword: "enum",
          params: { allowedValues: schema81.properties.type.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.title !== void 0) {
      let data2 = data.title;
      if (typeof data2 === "string") {
        if (func2(data2) > 120) {
          const err10 = {
            instancePath: instancePath + "/title",
            schemaPath: "#/properties/title/maxLength",
            keyword: "maxLength",
            params: { limit: 120 },
            message: "must NOT have more than 120 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err11 = {
            instancePath: instancePath + "/title",
            schemaPath: "#/properties/title/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/title",
          schemaPath: "#/properties/title/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.query !== void 0) {
      let data3 = data.query;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        if (data3.metric === void 0) {
          const err13 = {
            instancePath: instancePath + "/query",
            schemaPath: "#/properties/query/required",
            keyword: "required",
            params: { missingProperty: "metric" },
            message: "must have required property 'metric'",
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
        for (const key1 in data3) {
          if (!(key1 === "metric" || key1 === "dimension" || key1 === "limit" || key1 === "sort")) {
            const err14 = {
              instancePath: instancePath + "/query",
              schemaPath: "#/properties/query/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
        }
        if (data3.metric !== void 0) {
          let data4 = data3.metric;
          if (!(
            data4 === "income" ||
            data4 === "spending" ||
            data4 === "netCashFlow" ||
            data4 === "transactionCount" ||
            data4 === "savingsRate"
          )) {
            const err15 = {
              instancePath: instancePath + "/query/metric",
              schemaPath: "#/properties/query/properties/metric/enum",
              keyword: "enum",
              params: { allowedValues: schema81.properties.query.properties.metric.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
        if (data3.dimension !== void 0) {
          let data5 = data3.dimension;
          if (!(
            data5 === "month" ||
            data5 === "category" ||
            data5 === "merchant" ||
            data5 === "account" ||
            data5 === "day"
          )) {
            const err16 = {
              instancePath: instancePath + "/query/dimension",
              schemaPath: "#/properties/query/properties/dimension/enum",
              keyword: "enum",
              params: { allowedValues: schema81.properties.query.properties.dimension.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
        if (data3.limit !== void 0) {
          let data6 = data3.limit;
          if (!(typeof data6 == "number" && !(data6 % 1) && !isNaN(data6) && isFinite(data6))) {
            const err17 = {
              instancePath: instancePath + "/query/limit",
              schemaPath: "#/properties/query/properties/limit/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
          if (typeof data6 == "number" && isFinite(data6)) {
            if (data6 > 1e3 || isNaN(data6)) {
              const err18 = {
                instancePath: instancePath + "/query/limit",
                schemaPath: "#/properties/query/properties/limit/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 1e3 },
                message: "must be <= 1000",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
            if (data6 < 1 || isNaN(data6)) {
              const err19 = {
                instancePath: instancePath + "/query/limit",
                schemaPath: "#/properties/query/properties/limit/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
          }
        }
        if (data3.sort !== void 0) {
          let data7 = data3.sort;
          if (!(
            data7 === "valueAsc" ||
            data7 === "valueDesc" ||
            data7 === "labelAsc" ||
            data7 === "labelDesc" ||
            data7 === "dateAsc" ||
            data7 === "dateDesc"
          )) {
            const err20 = {
              instancePath: instancePath + "/query/sort",
              schemaPath: "#/properties/query/properties/sort/enum",
              keyword: "enum",
              params: { allowedValues: schema81.properties.query.properties.sort.enum },
              message: "must be equal to one of the allowed values",
            };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/query",
          schemaPath: "#/properties/query/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.layout !== void 0) {
      let data8 = data.layout;
      if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
        if (data8.x === void 0) {
          const err22 = {
            instancePath: instancePath + "/layout",
            schemaPath: "#/properties/layout/required",
            keyword: "required",
            params: { missingProperty: "x" },
            message: "must have required property 'x'",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        if (data8.y === void 0) {
          const err23 = {
            instancePath: instancePath + "/layout",
            schemaPath: "#/properties/layout/required",
            keyword: "required",
            params: { missingProperty: "y" },
            message: "must have required property 'y'",
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
        if (data8.width === void 0) {
          const err24 = {
            instancePath: instancePath + "/layout",
            schemaPath: "#/properties/layout/required",
            keyword: "required",
            params: { missingProperty: "width" },
            message: "must have required property 'width'",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data8.height === void 0) {
          const err25 = {
            instancePath: instancePath + "/layout",
            schemaPath: "#/properties/layout/required",
            keyword: "required",
            params: { missingProperty: "height" },
            message: "must have required property 'height'",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        for (const key2 in data8) {
          if (!(key2 === "x" || key2 === "y" || key2 === "width" || key2 === "height")) {
            const err26 = {
              instancePath: instancePath + "/layout",
              schemaPath: "#/properties/layout/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
        if (data8.x !== void 0) {
          let data9 = data8.x;
          if (!(typeof data9 == "number" && !(data9 % 1) && !isNaN(data9) && isFinite(data9))) {
            const err27 = {
              instancePath: instancePath + "/layout/x",
              schemaPath: "#/properties/layout/properties/x/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
          if (typeof data9 == "number" && isFinite(data9)) {
            if (data9 < 0 || isNaN(data9)) {
              const err28 = {
                instancePath: instancePath + "/layout/x",
                schemaPath: "#/properties/layout/properties/x/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
          }
        }
        if (data8.y !== void 0) {
          let data10 = data8.y;
          if (!(typeof data10 == "number" && !(data10 % 1) && !isNaN(data10) && isFinite(data10))) {
            const err29 = {
              instancePath: instancePath + "/layout/y",
              schemaPath: "#/properties/layout/properties/y/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
          if (typeof data10 == "number" && isFinite(data10)) {
            if (data10 < 0 || isNaN(data10)) {
              const err30 = {
                instancePath: instancePath + "/layout/y",
                schemaPath: "#/properties/layout/properties/y/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err30];
              } else {
                vErrors.push(err30);
              }
              errors++;
            }
          }
        }
        if (data8.width !== void 0) {
          let data11 = data8.width;
          if (!(typeof data11 == "number" && !(data11 % 1) && !isNaN(data11) && isFinite(data11))) {
            const err31 = {
              instancePath: instancePath + "/layout/width",
              schemaPath: "#/properties/layout/properties/width/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err31];
            } else {
              vErrors.push(err31);
            }
            errors++;
          }
          if (typeof data11 == "number" && isFinite(data11)) {
            if (data11 > 12 || isNaN(data11)) {
              const err32 = {
                instancePath: instancePath + "/layout/width",
                schemaPath: "#/properties/layout/properties/width/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 12 },
                message: "must be <= 12",
              };
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors++;
            }
            if (data11 < 1 || isNaN(data11)) {
              const err33 = {
                instancePath: instancePath + "/layout/width",
                schemaPath: "#/properties/layout/properties/width/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err33];
              } else {
                vErrors.push(err33);
              }
              errors++;
            }
          }
        }
        if (data8.height !== void 0) {
          let data12 = data8.height;
          if (!(typeof data12 == "number" && !(data12 % 1) && !isNaN(data12) && isFinite(data12))) {
            const err34 = {
              instancePath: instancePath + "/layout/height",
              schemaPath: "#/properties/layout/properties/height/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err34];
            } else {
              vErrors.push(err34);
            }
            errors++;
          }
          if (typeof data12 == "number" && isFinite(data12)) {
            if (data12 > 20 || isNaN(data12)) {
              const err35 = {
                instancePath: instancePath + "/layout/height",
                schemaPath: "#/properties/layout/properties/height/maximum",
                keyword: "maximum",
                params: { comparison: "<=", limit: 20 },
                message: "must be <= 20",
              };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
            if (data12 < 1 || isNaN(data12)) {
              const err36 = {
                instancePath: instancePath + "/layout/height",
                schemaPath: "#/properties/layout/properties/height/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 1 },
                message: "must be >= 1",
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
          }
        }
      } else {
        const err37 = {
          instancePath: instancePath + "/layout",
          schemaPath: "#/properties/layout/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.showTableAlternative !== void 0) {
      if (true !== data.showTableAlternative) {
        const err38 = {
          instancePath: instancePath + "/showTableAlternative",
          schemaPath: "#/properties/showTableAlternative/const",
          keyword: "const",
          params: { allowedValue: true },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
  } else {
    const err39 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err39];
    } else {
      vErrors.push(err39);
    }
    errors++;
  }
  validate44.errors = vErrors;
  return errors === 0;
}
validate44.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate41(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate41.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property 'schemaVersion'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.name === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.filters === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "filters" },
        message: "must have required property 'filters'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.widgets === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "widgets" },
        message: "must have required property 'widgets'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "schemaVersion" ||
        key0 === "id" ||
        key0 === "name" ||
        key0 === "filters" ||
        key0 === "widgets" ||
        key0 === "createdAt" ||
        key0 === "updatedAt"
      )) {
        const err7 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      if ("1.0.0" !== data.schemaVersion) {
        const err8 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "1.0.0" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (!formats0.test(data1)) {
          const err9 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data2 = data.name;
      if (typeof data2 === "string") {
        if (func2(data2) > 120) {
          const err11 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/maxLength",
            keyword: "maxLength",
            params: { limit: 120 },
            message: "must NOT have more than 120 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err12 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.filters !== void 0) {
      if (
        !validate42(data.filters, {
          instancePath: instancePath + "/filters",
          parentData: data,
          parentDataProperty: "filters",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate42.errors : vErrors.concat(validate42.errors);
        errors = vErrors.length;
      }
    }
    if (data.widgets !== void 0) {
      let data4 = data.widgets;
      if (Array.isArray(data4)) {
        if (data4.length > 50) {
          const err14 = {
            instancePath: instancePath + "/widgets",
            schemaPath: "#/properties/widgets/maxItems",
            keyword: "maxItems",
            params: { limit: 50 },
            message: "must NOT have more than 50 items",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data4.length < 1) {
          const err15 = {
            instancePath: instancePath + "/widgets",
            schemaPath: "#/properties/widgets/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
        const len0 = data4.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate44(data4[i0], {
              instancePath: instancePath + "/widgets/" + i0,
              parentData: data4,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate44.errors : vErrors.concat(validate44.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/widgets",
          schemaPath: "#/properties/widgets/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.createdAt !== void 0) {
      let data6 = data.createdAt;
      if (typeof data6 === "string") {
        if (!formats4.validate(data6)) {
          const err17 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.updatedAt !== void 0) {
      let data7 = data.updatedAt;
      if (typeof data7 === "string") {
        if (!formats4.validate(data7)) {
          const err19 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
  } else {
    const err21 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err21];
    } else {
      vErrors.push(err21);
    }
    errors++;
  }
  validate41.errors = vErrors;
  return errors === 0;
}
validate41.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var validateFinancialBrainSchema = validate46;
var schema85 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://financial-intelligence.local/schemas/financial-brain.schema.json",
  title: "Financial Brain",
  description:
    "Portable learned knowledge. Must not contain raw transactions, statements, account identifiers, or secrets.",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "brainId",
    "createdAt",
    "updatedAt",
    "producer",
    "categories",
    "merchants",
    "rules",
    "recurringDecisions",
    "preferences",
  ],
  properties: {
    schemaVersion: { const: "1.0.0" },
    brainId: { $ref: "#/$defs/uuid" },
    createdAt: { $ref: "#/$defs/dateTime" },
    updatedAt: { $ref: "#/$defs/dateTime" },
    producer: {
      type: "object",
      additionalProperties: false,
      required: ["application", "version"],
      properties: {
        application: { const: "Financial Intelligence" },
        version: { type: "string", minLength: 1, maxLength: 40 },
      },
    },
    categories: {
      type: "array",
      maxItems: 2e3,
      items: { $ref: "https://financial-intelligence.local/schemas/category.schema.json" },
    },
    merchants: {
      type: "array",
      maxItems: 5e4,
      items: { $ref: "https://financial-intelligence.local/schemas/merchant.schema.json" },
    },
    rules: { type: "array", maxItems: 5e4, items: { $ref: "#/$defs/rule" } },
    recurringDecisions: {
      type: "array",
      maxItems: 1e4,
      items: { $ref: "#/$defs/recurringDecision" },
    },
    preferences: { $ref: "#/$defs/preferences" },
    extensions: {
      type: "object",
      propertyNames: { pattern: "^[a-z][a-z0-9]*(?:\\.[a-z0-9-]+)+$" },
      additionalProperties: true,
      maxProperties: 100,
    },
  },
  $defs: {
    uuid: { type: "string", format: "uuid" },
    dateTime: { type: "string", format: "date-time" },
    decimal: { type: "string", pattern: "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" },
    condition: {
      type: "object",
      additionalProperties: false,
      required: ["field", "operator", "value"],
      properties: {
        field: {
          enum: [
            "normalizedDescription",
            "merchantId",
            "accountId",
            "accountType",
            "postedDate",
            "direction",
            "amount",
            "categoryId",
            "tag",
          ],
        },
        operator: { enum: ["equals", "contains", "startsWith", "inRange"] },
        value: {
          oneOf: [
            { type: "string", minLength: 1, maxLength: 240 },
            {
              type: "object",
              additionalProperties: false,
              required: ["minimum", "maximum"],
              properties: {
                minimum: { $ref: "#/$defs/decimal" },
                maximum: { $ref: "#/$defs/decimal" },
              },
            },
          ],
        },
      },
    },
    action: {
      type: "object",
      additionalProperties: false,
      required: ["type", "value"],
      properties: {
        type: {
          enum: [
            "setMerchant",
            "setCategory",
            "addTag",
            "removeTag",
            "markReviewed",
            "markIgnored",
          ],
        },
        value: { oneOf: [{ type: "string", minLength: 1, maxLength: 240 }, { type: "boolean" }] },
      },
    },
    rule: {
      type: "object",
      additionalProperties: false,
      required: [
        "schemaVersion",
        "id",
        "name",
        "enabled",
        "priority",
        "conditions",
        "actions",
        "createdBy",
        "createdAt",
        "updatedAt",
      ],
      properties: {
        schemaVersion: { const: "1.0.0" },
        id: { $ref: "#/$defs/uuid" },
        name: { type: "string", minLength: 1, maxLength: 160 },
        enabled: { type: "boolean" },
        priority: { type: "integer", minimum: -1e5, maximum: 1e5 },
        conditions: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: { $ref: "#/$defs/condition" },
        },
        actions: { type: "array", minItems: 1, maxItems: 20, items: { $ref: "#/$defs/action" } },
        createdBy: { enum: ["user", "suggestedHeuristic", "suggestedAi", "importedBrain"] },
        createdAt: { $ref: "#/$defs/dateTime" },
        updatedAt: { $ref: "#/$defs/dateTime" },
      },
    },
    recurringDecision: {
      type: "object",
      additionalProperties: false,
      required: ["id", "signature", "status", "updatedAt"],
      properties: {
        id: { $ref: "#/$defs/uuid" },
        signature: { type: "string", minLength: 1, maxLength: 240 },
        name: { type: "string", minLength: 1, maxLength: 160 },
        merchantId: { $ref: "#/$defs/uuid" },
        status: { enum: ["confirmed", "dismissed", "muted"] },
        cadence: { enum: ["weekly", "biweekly", "monthly", "quarterly", "yearly", "irregular"] },
        toleranceDays: { type: "integer", minimum: 0, maximum: 31 },
        updatedAt: { $ref: "#/$defs/dateTime" },
      },
    },
    preferences: {
      type: "object",
      additionalProperties: false,
      required: ["locale", "firstDayOfWeek", "reviewConfidenceThreshold"],
      properties: {
        locale: { type: "string", pattern: "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$" },
        firstDayOfWeek: { enum: ["monday", "sunday", "saturday"] },
        reviewConfidenceThreshold: { type: "number", minimum: 0, maximum: 1 },
        categoryDisplayOrder: { type: "array", uniqueItems: true, items: { $ref: "#/$defs/uuid" } },
      },
    },
  },
};
var schema91 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "pattern", "matchMode", "normalizerVersion", "createdAt"],
  properties: {
    id: { $ref: "#/$defs/uuid" },
    pattern: { type: "string", minLength: 1, maxLength: 240 },
    matchMode: { enum: ["exact", "tokenPrefix", "contains"] },
    normalizerVersion: { type: "string", pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    createdAt: { $ref: "#/$defs/dateTime" },
  },
};
var pattern8 = new RegExp("^[0-9]+\\.[0-9]+\\.[0-9]+$", "u");
function validate49(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate49.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.pattern === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "pattern" },
        message: "must have required property 'pattern'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.matchMode === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "matchMode" },
        message: "must have required property 'matchMode'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.normalizerVersion === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "normalizerVersion" },
        message: "must have required property 'normalizerVersion'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "id" ||
        key0 === "pattern" ||
        key0 === "matchMode" ||
        key0 === "normalizerVersion" ||
        key0 === "createdAt"
      )) {
        const err5 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!formats0.test(data0)) {
          const err6 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.pattern !== void 0) {
      let data1 = data.pattern;
      if (typeof data1 === "string") {
        if (func2(data1) > 240) {
          const err8 = {
            instancePath: instancePath + "/pattern",
            schemaPath: "#/properties/pattern/maxLength",
            keyword: "maxLength",
            params: { limit: 240 },
            message: "must NOT have more than 240 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err9 = {
            instancePath: instancePath + "/pattern",
            schemaPath: "#/properties/pattern/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/pattern",
          schemaPath: "#/properties/pattern/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.matchMode !== void 0) {
      let data2 = data.matchMode;
      if (!(data2 === "exact" || data2 === "tokenPrefix" || data2 === "contains")) {
        const err11 = {
          instancePath: instancePath + "/matchMode",
          schemaPath: "#/properties/matchMode/enum",
          keyword: "enum",
          params: { allowedValues: schema91.properties.matchMode.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.normalizerVersion !== void 0) {
      let data3 = data.normalizerVersion;
      if (typeof data3 === "string") {
        if (!pattern8.test(data3)) {
          const err12 = {
            instancePath: instancePath + "/normalizerVersion",
            schemaPath: "#/properties/normalizerVersion/pattern",
            keyword: "pattern",
            params: { pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
            message: 'must match pattern "^[0-9]+\\.[0-9]+\\.[0-9]+$"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/normalizerVersion",
          schemaPath: "#/properties/normalizerVersion/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.createdAt !== void 0) {
      let data4 = data.createdAt;
      if (typeof data4 === "string") {
        if (!formats4.validate(data4)) {
          const err14 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
  } else {
    const err16 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err16];
    } else {
      vErrors.push(err16);
    }
    errors++;
  }
  validate49.errors = vErrors;
  return errors === 0;
}
validate49.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var pattern9 = new RegExp(
  "^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}$",
  "u",
);
function validate48(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate48.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.name === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.aliases === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "aliases" },
        message: "must have required property 'aliases'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.archived === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "archived" },
        message: "must have required property 'archived'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "id" ||
        key0 === "name" ||
        key0 === "aliases" ||
        key0 === "websiteDomain" ||
        key0 === "redirectToId" ||
        key0 === "archived" ||
        key0 === "createdAt" ||
        key0 === "updatedAt"
      )) {
        const err6 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!formats0.test(data0)) {
          const err7 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data1 = data.name;
      if (typeof data1 === "string") {
        if (func2(data1) > 160) {
          const err9 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/maxLength",
            keyword: "maxLength",
            params: { limit: 160 },
            message: "must NOT have more than 160 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err10 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
      } else {
        const err11 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.aliases !== void 0) {
      let data2 = data.aliases;
      if (Array.isArray(data2)) {
        if (data2.length > 500) {
          const err12 = {
            instancePath: instancePath + "/aliases",
            schemaPath: "#/properties/aliases/maxItems",
            keyword: "maxItems",
            params: { limit: 500 },
            message: "must NOT have more than 500 items",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate49(data2[i0], {
              instancePath: instancePath + "/aliases/" + i0,
              parentData: data2,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate49.errors : vErrors.concat(validate49.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/aliases",
          schemaPath: "#/properties/aliases/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.websiteDomain !== void 0) {
      let data4 = data.websiteDomain;
      if (typeof data4 === "string") {
        if (func2(data4) > 253) {
          const err14 = {
            instancePath: instancePath + "/websiteDomain",
            schemaPath: "#/properties/websiteDomain/maxLength",
            keyword: "maxLength",
            params: { limit: 253 },
            message: "must NOT have more than 253 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (!pattern9.test(data4)) {
          const err15 = {
            instancePath: instancePath + "/websiteDomain",
            schemaPath: "#/properties/websiteDomain/pattern",
            keyword: "pattern",
            params: {
              pattern: "^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}$",
            },
            message:
              'must match pattern "^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\\.)+[A-Za-z]{2,63}$"',
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/websiteDomain",
          schemaPath: "#/properties/websiteDomain/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.redirectToId !== void 0) {
      let data5 = data.redirectToId;
      if (typeof data5 === "string") {
        if (!formats0.test(data5)) {
          const err17 = {
            instancePath: instancePath + "/redirectToId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/redirectToId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.archived !== void 0) {
      if (typeof data.archived !== "boolean") {
        const err19 = {
          instancePath: instancePath + "/archived",
          schemaPath: "#/properties/archived/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    if (data.createdAt !== void 0) {
      let data7 = data.createdAt;
      if (typeof data7 === "string") {
        if (!formats4.validate(data7)) {
          const err20 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.updatedAt !== void 0) {
      let data8 = data.updatedAt;
      if (typeof data8 === "string") {
        if (!formats4.validate(data8)) {
          const err22 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
  } else {
    const err24 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err24];
    } else {
      vErrors.push(err24);
    }
    errors++;
  }
  validate48.errors = vErrors;
  return errors === 0;
}
validate48.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema97 = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "id",
    "name",
    "enabled",
    "priority",
    "conditions",
    "actions",
    "createdBy",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    schemaVersion: { const: "1.0.0" },
    id: { $ref: "#/$defs/uuid" },
    name: { type: "string", minLength: 1, maxLength: 160 },
    enabled: { type: "boolean" },
    priority: { type: "integer", minimum: -1e5, maximum: 1e5 },
    conditions: { type: "array", minItems: 1, maxItems: 20, items: { $ref: "#/$defs/condition" } },
    actions: { type: "array", minItems: 1, maxItems: 20, items: { $ref: "#/$defs/action" } },
    createdBy: { enum: ["user", "suggestedHeuristic", "suggestedAi", "importedBrain"] },
    createdAt: { $ref: "#/$defs/dateTime" },
    updatedAt: { $ref: "#/$defs/dateTime" },
  },
};
var schema102 = {
  type: "object",
  additionalProperties: false,
  required: ["type", "value"],
  properties: {
    type: {
      enum: ["setMerchant", "setCategory", "addTag", "removeTag", "markReviewed", "markIgnored"],
    },
    value: { oneOf: [{ type: "string", minLength: 1, maxLength: 240 }, { type: "boolean" }] },
  },
};
var schema99 = {
  type: "object",
  additionalProperties: false,
  required: ["field", "operator", "value"],
  properties: {
    field: {
      enum: [
        "normalizedDescription",
        "merchantId",
        "accountId",
        "accountType",
        "postedDate",
        "direction",
        "amount",
        "categoryId",
        "tag",
      ],
    },
    operator: { enum: ["equals", "contains", "startsWith", "inRange"] },
    value: {
      oneOf: [
        { type: "string", minLength: 1, maxLength: 240 },
        {
          type: "object",
          additionalProperties: false,
          required: ["minimum", "maximum"],
          properties: {
            minimum: { $ref: "#/$defs/decimal" },
            maximum: { $ref: "#/$defs/decimal" },
          },
        },
      ],
    },
  },
};
var pattern10 = new RegExp("^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$", "u");
function validate53(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate53.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.field === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "field" },
        message: "must have required property 'field'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.operator === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "operator" },
        message: "must have required property 'operator'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.value === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "value" },
        message: "must have required property 'value'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(key0 === "field" || key0 === "operator" || key0 === "value")) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.field !== void 0) {
      let data0 = data.field;
      if (!(
        data0 === "normalizedDescription" ||
        data0 === "merchantId" ||
        data0 === "accountId" ||
        data0 === "accountType" ||
        data0 === "postedDate" ||
        data0 === "direction" ||
        data0 === "amount" ||
        data0 === "categoryId" ||
        data0 === "tag"
      )) {
        const err4 = {
          instancePath: instancePath + "/field",
          schemaPath: "#/properties/field/enum",
          keyword: "enum",
          params: { allowedValues: schema99.properties.field.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.operator !== void 0) {
      let data1 = data.operator;
      if (!(
        data1 === "equals" ||
        data1 === "contains" ||
        data1 === "startsWith" ||
        data1 === "inRange"
      )) {
        const err5 = {
          instancePath: instancePath + "/operator",
          schemaPath: "#/properties/operator/enum",
          keyword: "enum",
          params: { allowedValues: schema99.properties.operator.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.value !== void 0) {
      let data2 = data.value;
      const _errs5 = errors;
      let valid1 = false;
      let passing0 = null;
      const _errs6 = errors;
      if (typeof data2 === "string") {
        if (func2(data2) > 240) {
          const err6 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/oneOf/0/maxLength",
            keyword: "maxLength",
            params: { limit: 240 },
            message: "must NOT have more than 240 characters",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err7 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/oneOf/0/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/oneOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
      var _valid0 = _errs6 === errors;
      if (_valid0) {
        valid1 = true;
        passing0 = 0;
      }
      const _errs8 = errors;
      if (data2 && typeof data2 == "object" && !Array.isArray(data2)) {
        if (data2.minimum === void 0) {
          const err9 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/oneOf/1/required",
            keyword: "required",
            params: { missingProperty: "minimum" },
            message: "must have required property 'minimum'",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
        if (data2.maximum === void 0) {
          const err10 = {
            instancePath: instancePath + "/value",
            schemaPath: "#/properties/value/oneOf/1/required",
            keyword: "required",
            params: { missingProperty: "maximum" },
            message: "must have required property 'maximum'",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        for (const key1 in data2) {
          if (!(key1 === "minimum" || key1 === "maximum")) {
            const err11 = {
              instancePath: instancePath + "/value",
              schemaPath: "#/properties/value/oneOf/1/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
        if (data2.minimum !== void 0) {
          let data3 = data2.minimum;
          if (typeof data3 === "string") {
            if (!pattern10.test(data3)) {
              const err12 = {
                instancePath: instancePath + "/value/minimum",
                schemaPath: "#/$defs/decimal/pattern",
                keyword: "pattern",
                params: { pattern: "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" },
                message: 'must match pattern "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$"',
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
          } else {
            const err13 = {
              instancePath: instancePath + "/value/minimum",
              schemaPath: "#/$defs/decimal/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
        }
        if (data2.maximum !== void 0) {
          let data4 = data2.maximum;
          if (typeof data4 === "string") {
            if (!pattern10.test(data4)) {
              const err14 = {
                instancePath: instancePath + "/value/maximum",
                schemaPath: "#/$defs/decimal/pattern",
                keyword: "pattern",
                params: { pattern: "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" },
                message: 'must match pattern "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$"',
              };
              if (vErrors === null) {
                vErrors = [err14];
              } else {
                vErrors.push(err14);
              }
              errors++;
            }
          } else {
            const err15 = {
              instancePath: instancePath + "/value/maximum",
              schemaPath: "#/$defs/decimal/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/oneOf/1/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
      var _valid0 = _errs8 === errors;
      if (_valid0 && valid1) {
        valid1 = false;
        passing0 = [passing0, 1];
      } else {
        if (_valid0) {
          valid1 = true;
          passing0 = 1;
        }
      }
      if (!valid1) {
        const err17 = {
          instancePath: instancePath + "/value",
          schemaPath: "#/properties/value/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: passing0 },
          message: "must match exactly one schema in oneOf",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      } else {
        errors = _errs5;
        if (vErrors !== null) {
          if (_errs5) {
            vErrors.length = _errs5;
          } else {
            vErrors = null;
          }
        }
      }
    }
  } else {
    const err18 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  }
  validate53.errors = vErrors;
  return errors === 0;
}
validate53.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate52(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate52.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property 'schemaVersion'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.name === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "name" },
        message: "must have required property 'name'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.enabled === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "enabled" },
        message: "must have required property 'enabled'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.priority === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "priority" },
        message: "must have required property 'priority'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.conditions === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "conditions" },
        message: "must have required property 'conditions'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.actions === void 0) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "actions" },
        message: "must have required property 'actions'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.createdBy === void 0) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdBy" },
        message: "must have required property 'createdBy'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema97.properties, key0)) {
        const err10 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      if ("1.0.0" !== data.schemaVersion) {
        const err11 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "1.0.0" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (!formats0.test(data1)) {
          const err12 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data2 = data.name;
      if (typeof data2 === "string") {
        if (func2(data2) > 160) {
          const err14 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/maxLength",
            keyword: "maxLength",
            params: { limit: 160 },
            message: "must NOT have more than 160 characters",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err15 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.enabled !== void 0) {
      if (typeof data.enabled !== "boolean") {
        const err17 = {
          instancePath: instancePath + "/enabled",
          schemaPath: "#/properties/enabled/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.priority !== void 0) {
      let data4 = data.priority;
      if (!(typeof data4 == "number" && !(data4 % 1) && !isNaN(data4) && isFinite(data4))) {
        const err18 = {
          instancePath: instancePath + "/priority",
          schemaPath: "#/properties/priority/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
      if (typeof data4 == "number" && isFinite(data4)) {
        if (data4 > 1e5 || isNaN(data4)) {
          const err19 = {
            instancePath: instancePath + "/priority",
            schemaPath: "#/properties/priority/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 1e5 },
            message: "must be <= 100000",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (data4 < -1e5 || isNaN(data4)) {
          const err20 = {
            instancePath: instancePath + "/priority",
            schemaPath: "#/properties/priority/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: -1e5 },
            message: "must be >= -100000",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      }
    }
    if (data.conditions !== void 0) {
      let data5 = data.conditions;
      if (Array.isArray(data5)) {
        if (data5.length > 20) {
          const err21 = {
            instancePath: instancePath + "/conditions",
            schemaPath: "#/properties/conditions/maxItems",
            keyword: "maxItems",
            params: { limit: 20 },
            message: "must NOT have more than 20 items",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        if (data5.length < 1) {
          const err22 = {
            instancePath: instancePath + "/conditions",
            schemaPath: "#/properties/conditions/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
        const len0 = data5.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate53(data5[i0], {
              instancePath: instancePath + "/conditions/" + i0,
              parentData: data5,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate53.errors : vErrors.concat(validate53.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err23 = {
          instancePath: instancePath + "/conditions",
          schemaPath: "#/properties/conditions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err23];
        } else {
          vErrors.push(err23);
        }
        errors++;
      }
    }
    if (data.actions !== void 0) {
      let data7 = data.actions;
      if (Array.isArray(data7)) {
        if (data7.length > 20) {
          const err24 = {
            instancePath: instancePath + "/actions",
            schemaPath: "#/properties/actions/maxItems",
            keyword: "maxItems",
            params: { limit: 20 },
            message: "must NOT have more than 20 items",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
        if (data7.length < 1) {
          const err25 = {
            instancePath: instancePath + "/actions",
            schemaPath: "#/properties/actions/minItems",
            keyword: "minItems",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 items",
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
        const len1 = data7.length;
        for (let i1 = 0; i1 < len1; i1++) {
          let data8 = data7[i1];
          if (data8 && typeof data8 == "object" && !Array.isArray(data8)) {
            if (data8.type === void 0) {
              const err26 = {
                instancePath: instancePath + "/actions/" + i1,
                schemaPath: "#/$defs/action/required",
                keyword: "required",
                params: { missingProperty: "type" },
                message: "must have required property 'type'",
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
            if (data8.value === void 0) {
              const err27 = {
                instancePath: instancePath + "/actions/" + i1,
                schemaPath: "#/$defs/action/required",
                keyword: "required",
                params: { missingProperty: "value" },
                message: "must have required property 'value'",
              };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
            for (const key1 in data8) {
              if (!(key1 === "type" || key1 === "value")) {
                const err28 = {
                  instancePath: instancePath + "/actions/" + i1,
                  schemaPath: "#/$defs/action/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key1 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err28];
                } else {
                  vErrors.push(err28);
                }
                errors++;
              }
            }
            if (data8.type !== void 0) {
              let data9 = data8.type;
              if (!(
                data9 === "setMerchant" ||
                data9 === "setCategory" ||
                data9 === "addTag" ||
                data9 === "removeTag" ||
                data9 === "markReviewed" ||
                data9 === "markIgnored"
              )) {
                const err29 = {
                  instancePath: instancePath + "/actions/" + i1 + "/type",
                  schemaPath: "#/$defs/action/properties/type/enum",
                  keyword: "enum",
                  params: { allowedValues: schema102.properties.type.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err29];
                } else {
                  vErrors.push(err29);
                }
                errors++;
              }
            }
            if (data8.value !== void 0) {
              let data10 = data8.value;
              const _errs23 = errors;
              let valid8 = false;
              let passing0 = null;
              const _errs24 = errors;
              if (typeof data10 === "string") {
                if (func2(data10) > 240) {
                  const err30 = {
                    instancePath: instancePath + "/actions/" + i1 + "/value",
                    schemaPath: "#/$defs/action/properties/value/oneOf/0/maxLength",
                    keyword: "maxLength",
                    params: { limit: 240 },
                    message: "must NOT have more than 240 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err30];
                  } else {
                    vErrors.push(err30);
                  }
                  errors++;
                }
                if (func2(data10) < 1) {
                  const err31 = {
                    instancePath: instancePath + "/actions/" + i1 + "/value",
                    schemaPath: "#/$defs/action/properties/value/oneOf/0/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err31];
                  } else {
                    vErrors.push(err31);
                  }
                  errors++;
                }
              } else {
                const err32 = {
                  instancePath: instancePath + "/actions/" + i1 + "/value",
                  schemaPath: "#/$defs/action/properties/value/oneOf/0/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err32];
                } else {
                  vErrors.push(err32);
                }
                errors++;
              }
              var _valid0 = _errs24 === errors;
              if (_valid0) {
                valid8 = true;
                passing0 = 0;
              }
              const _errs26 = errors;
              if (typeof data10 !== "boolean") {
                const err33 = {
                  instancePath: instancePath + "/actions/" + i1 + "/value",
                  schemaPath: "#/$defs/action/properties/value/oneOf/1/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err33];
                } else {
                  vErrors.push(err33);
                }
                errors++;
              }
              var _valid0 = _errs26 === errors;
              if (_valid0 && valid8) {
                valid8 = false;
                passing0 = [passing0, 1];
              } else {
                if (_valid0) {
                  valid8 = true;
                  passing0 = 1;
                }
              }
              if (!valid8) {
                const err34 = {
                  instancePath: instancePath + "/actions/" + i1 + "/value",
                  schemaPath: "#/$defs/action/properties/value/oneOf",
                  keyword: "oneOf",
                  params: { passingSchemas: passing0 },
                  message: "must match exactly one schema in oneOf",
                };
                if (vErrors === null) {
                  vErrors = [err34];
                } else {
                  vErrors.push(err34);
                }
                errors++;
              } else {
                errors = _errs23;
                if (vErrors !== null) {
                  if (_errs23) {
                    vErrors.length = _errs23;
                  } else {
                    vErrors = null;
                  }
                }
              }
            }
          } else {
            const err35 = {
              instancePath: instancePath + "/actions/" + i1,
              schemaPath: "#/$defs/action/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err35];
            } else {
              vErrors.push(err35);
            }
            errors++;
          }
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/actions",
          schemaPath: "#/properties/actions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.createdBy !== void 0) {
      let data11 = data.createdBy;
      if (!(
        data11 === "user" ||
        data11 === "suggestedHeuristic" ||
        data11 === "suggestedAi" ||
        data11 === "importedBrain"
      )) {
        const err37 = {
          instancePath: instancePath + "/createdBy",
          schemaPath: "#/properties/createdBy/enum",
          keyword: "enum",
          params: { allowedValues: schema97.properties.createdBy.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
    if (data.createdAt !== void 0) {
      let data12 = data.createdAt;
      if (typeof data12 === "string") {
        if (!formats4.validate(data12)) {
          const err38 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
      } else {
        const err39 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err39];
        } else {
          vErrors.push(err39);
        }
        errors++;
      }
    }
    if (data.updatedAt !== void 0) {
      let data13 = data.updatedAt;
      if (typeof data13 === "string") {
        if (!formats4.validate(data13)) {
          const err40 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err40];
          } else {
            vErrors.push(err40);
          }
          errors++;
        }
      } else {
        const err41 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err41];
        } else {
          vErrors.push(err41);
        }
        errors++;
      }
    }
  } else {
    const err42 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err42];
    } else {
      vErrors.push(err42);
    }
    errors++;
  }
  validate52.errors = vErrors;
  return errors === 0;
}
validate52.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema105 = {
  type: "object",
  additionalProperties: false,
  required: ["id", "signature", "status", "updatedAt"],
  properties: {
    id: { $ref: "#/$defs/uuid" },
    signature: { type: "string", minLength: 1, maxLength: 240 },
    name: { type: "string", minLength: 1, maxLength: 160 },
    merchantId: { $ref: "#/$defs/uuid" },
    status: { enum: ["confirmed", "dismissed", "muted"] },
    cadence: { enum: ["weekly", "biweekly", "monthly", "quarterly", "yearly", "irregular"] },
    toleranceDays: { type: "integer", minimum: 0, maximum: 31 },
    updatedAt: { $ref: "#/$defs/dateTime" },
  },
};
function validate56(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate56.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.id === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.signature === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "signature" },
        message: "must have required property 'signature'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.status === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "status" },
        message: "must have required property 'status'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "id" ||
        key0 === "signature" ||
        key0 === "name" ||
        key0 === "merchantId" ||
        key0 === "status" ||
        key0 === "cadence" ||
        key0 === "toleranceDays" ||
        key0 === "updatedAt"
      )) {
        const err4 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data0 = data.id;
      if (typeof data0 === "string") {
        if (!formats0.test(data0)) {
          const err5 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.signature !== void 0) {
      let data1 = data.signature;
      if (typeof data1 === "string") {
        if (func2(data1) > 240) {
          const err7 = {
            instancePath: instancePath + "/signature",
            schemaPath: "#/properties/signature/maxLength",
            keyword: "maxLength",
            params: { limit: 240 },
            message: "must NOT have more than 240 characters",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err8 = {
            instancePath: instancePath + "/signature",
            schemaPath: "#/properties/signature/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/signature",
          schemaPath: "#/properties/signature/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.name !== void 0) {
      let data2 = data.name;
      if (typeof data2 === "string") {
        if (func2(data2) > 160) {
          const err10 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/maxLength",
            keyword: "maxLength",
            params: { limit: 160 },
            message: "must NOT have more than 160 characters",
          };
          if (vErrors === null) {
            vErrors = [err10];
          } else {
            vErrors.push(err10);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err11 = {
            instancePath: instancePath + "/name",
            schemaPath: "#/properties/name/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.merchantId !== void 0) {
      let data3 = data.merchantId;
      if (typeof data3 === "string") {
        if (!formats0.test(data3)) {
          const err13 = {
            instancePath: instancePath + "/merchantId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/merchantId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.status !== void 0) {
      let data4 = data.status;
      if (!(data4 === "confirmed" || data4 === "dismissed" || data4 === "muted")) {
        const err15 = {
          instancePath: instancePath + "/status",
          schemaPath: "#/properties/status/enum",
          keyword: "enum",
          params: { allowedValues: schema105.properties.status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.cadence !== void 0) {
      let data5 = data.cadence;
      if (!(
        data5 === "weekly" ||
        data5 === "biweekly" ||
        data5 === "monthly" ||
        data5 === "quarterly" ||
        data5 === "yearly" ||
        data5 === "irregular"
      )) {
        const err16 = {
          instancePath: instancePath + "/cadence",
          schemaPath: "#/properties/cadence/enum",
          keyword: "enum",
          params: { allowedValues: schema105.properties.cadence.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.toleranceDays !== void 0) {
      let data6 = data.toleranceDays;
      if (!(typeof data6 == "number" && !(data6 % 1) && !isNaN(data6) && isFinite(data6))) {
        const err17 = {
          instancePath: instancePath + "/toleranceDays",
          schemaPath: "#/properties/toleranceDays/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
      if (typeof data6 == "number" && isFinite(data6)) {
        if (data6 > 31 || isNaN(data6)) {
          const err18 = {
            instancePath: instancePath + "/toleranceDays",
            schemaPath: "#/properties/toleranceDays/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 31 },
            message: "must be <= 31",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (data6 < 0 || isNaN(data6)) {
          const err19 = {
            instancePath: instancePath + "/toleranceDays",
            schemaPath: "#/properties/toleranceDays/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      }
    }
    if (data.updatedAt !== void 0) {
      let data7 = data.updatedAt;
      if (typeof data7 === "string") {
        if (!formats4.validate(data7)) {
          const err20 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
  } else {
    const err22 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err22];
    } else {
      vErrors.push(err22);
    }
    errors++;
  }
  validate56.errors = vErrors;
  return errors === 0;
}
validate56.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var schema109 = {
  type: "object",
  additionalProperties: false,
  required: ["locale", "firstDayOfWeek", "reviewConfidenceThreshold"],
  properties: {
    locale: { type: "string", pattern: "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$" },
    firstDayOfWeek: { enum: ["monday", "sunday", "saturday"] },
    reviewConfidenceThreshold: { type: "number", minimum: 0, maximum: 1 },
    categoryDisplayOrder: { type: "array", uniqueItems: true, items: { $ref: "#/$defs/uuid" } },
  },
};
var pattern12 = new RegExp("^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$", "u");
function validate58(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate58.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.locale === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "locale" },
        message: "must have required property 'locale'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.firstDayOfWeek === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "firstDayOfWeek" },
        message: "must have required property 'firstDayOfWeek'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.reviewConfidenceThreshold === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "reviewConfidenceThreshold" },
        message: "must have required property 'reviewConfidenceThreshold'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "locale" ||
        key0 === "firstDayOfWeek" ||
        key0 === "reviewConfidenceThreshold" ||
        key0 === "categoryDisplayOrder"
      )) {
        const err3 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.locale !== void 0) {
      let data0 = data.locale;
      if (typeof data0 === "string") {
        if (!pattern12.test(data0)) {
          const err4 = {
            instancePath: instancePath + "/locale",
            schemaPath: "#/properties/locale/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$" },
            message: 'must match pattern "^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$"',
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/locale",
          schemaPath: "#/properties/locale/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.firstDayOfWeek !== void 0) {
      let data1 = data.firstDayOfWeek;
      if (!(data1 === "monday" || data1 === "sunday" || data1 === "saturday")) {
        const err6 = {
          instancePath: instancePath + "/firstDayOfWeek",
          schemaPath: "#/properties/firstDayOfWeek/enum",
          keyword: "enum",
          params: { allowedValues: schema109.properties.firstDayOfWeek.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.reviewConfidenceThreshold !== void 0) {
      let data2 = data.reviewConfidenceThreshold;
      if (typeof data2 == "number" && isFinite(data2)) {
        if (data2 > 1 || isNaN(data2)) {
          const err7 = {
            instancePath: instancePath + "/reviewConfidenceThreshold",
            schemaPath: "#/properties/reviewConfidenceThreshold/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 1 },
            message: "must be <= 1",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
        if (data2 < 0 || isNaN(data2)) {
          const err8 = {
            instancePath: instancePath + "/reviewConfidenceThreshold",
            schemaPath: "#/properties/reviewConfidenceThreshold/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/reviewConfidenceThreshold",
          schemaPath: "#/properties/reviewConfidenceThreshold/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.categoryDisplayOrder !== void 0) {
      let data3 = data.categoryDisplayOrder;
      if (Array.isArray(data3)) {
        const len0 = data3.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data4 = data3[i0];
          if (typeof data4 === "string") {
            if (!formats0.test(data4)) {
              const err10 = {
                instancePath: instancePath + "/categoryDisplayOrder/" + i0,
                schemaPath: "#/$defs/uuid/format",
                keyword: "format",
                params: { format: "uuid" },
                message: 'must match format "uuid"',
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
          } else {
            const err11 = {
              instancePath: instancePath + "/categoryDisplayOrder/" + i0,
              schemaPath: "#/$defs/uuid/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
        let i1 = data3.length;
        let j0;
        if (i1 > 1) {
          outer0: for (; i1--;) {
            for (j0 = i1; j0--;) {
              if (func0(data3[i1], data3[j0])) {
                const err12 = {
                  instancePath: instancePath + "/categoryDisplayOrder",
                  schemaPath: "#/properties/categoryDisplayOrder/uniqueItems",
                  keyword: "uniqueItems",
                  params: { i: i1, j: j0 },
                  message:
                    "must NOT have duplicate items (items ## " +
                    j0 +
                    " and " +
                    i1 +
                    " are identical)",
                };
                if (vErrors === null) {
                  vErrors = [err12];
                } else {
                  vErrors.push(err12);
                }
                errors++;
                break outer0;
              }
            }
          }
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/categoryDisplayOrder",
          schemaPath: "#/properties/categoryDisplayOrder/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
  } else {
    const err14 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err14];
    } else {
      vErrors.push(err14);
    }
    errors++;
  }
  validate58.errors = vErrors;
  return errors === 0;
}
validate58.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var pattern13 = new RegExp("^[a-z][a-z0-9]*(?:\\.[a-z0-9-]+)+$", "u");
function validate46(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate46.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property 'schemaVersion'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.brainId === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "brainId" },
        message: "must have required property 'brainId'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.producer === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "producer" },
        message: "must have required property 'producer'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.categories === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "categories" },
        message: "must have required property 'categories'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.merchants === void 0) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "merchants" },
        message: "must have required property 'merchants'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.rules === void 0) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "rules" },
        message: "must have required property 'rules'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.recurringDecisions === void 0) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "recurringDecisions" },
        message: "must have required property 'recurringDecisions'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.preferences === void 0) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "preferences" },
        message: "must have required property 'preferences'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema85.properties, key0)) {
        const err10 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      if ("1.0.0" !== data.schemaVersion) {
        const err11 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "1.0.0" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.brainId !== void 0) {
      let data1 = data.brainId;
      if (typeof data1 === "string") {
        if (!formats0.test(data1)) {
          const err12 = {
            instancePath: instancePath + "/brainId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/brainId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.createdAt !== void 0) {
      let data2 = data.createdAt;
      if (typeof data2 === "string") {
        if (!formats4.validate(data2)) {
          const err14 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      } else {
        const err15 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.updatedAt !== void 0) {
      let data3 = data.updatedAt;
      if (typeof data3 === "string") {
        if (!formats4.validate(data3)) {
          const err16 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.producer !== void 0) {
      let data4 = data.producer;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        if (data4.application === void 0) {
          const err18 = {
            instancePath: instancePath + "/producer",
            schemaPath: "#/properties/producer/required",
            keyword: "required",
            params: { missingProperty: "application" },
            message: "must have required property 'application'",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (data4.version === void 0) {
          const err19 = {
            instancePath: instancePath + "/producer",
            schemaPath: "#/properties/producer/required",
            keyword: "required",
            params: { missingProperty: "version" },
            message: "must have required property 'version'",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        for (const key1 in data4) {
          if (!(key1 === "application" || key1 === "version")) {
            const err20 = {
              instancePath: instancePath + "/producer",
              schemaPath: "#/properties/producer/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
        if (data4.application !== void 0) {
          if ("Financial Intelligence" !== data4.application) {
            const err21 = {
              instancePath: instancePath + "/producer/application",
              schemaPath: "#/properties/producer/properties/application/const",
              keyword: "const",
              params: { allowedValue: "Financial Intelligence" },
              message: "must be equal to constant",
            };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
        if (data4.version !== void 0) {
          let data6 = data4.version;
          if (typeof data6 === "string") {
            if (func2(data6) > 40) {
              const err22 = {
                instancePath: instancePath + "/producer/version",
                schemaPath: "#/properties/producer/properties/version/maxLength",
                keyword: "maxLength",
                params: { limit: 40 },
                message: "must NOT have more than 40 characters",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
            if (func2(data6) < 1) {
              const err23 = {
                instancePath: instancePath + "/producer/version",
                schemaPath: "#/properties/producer/properties/version/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
          } else {
            const err24 = {
              instancePath: instancePath + "/producer/version",
              schemaPath: "#/properties/producer/properties/version/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err24];
            } else {
              vErrors.push(err24);
            }
            errors++;
          }
        }
      } else {
        const err25 = {
          instancePath: instancePath + "/producer",
          schemaPath: "#/properties/producer/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err25];
        } else {
          vErrors.push(err25);
        }
        errors++;
      }
    }
    if (data.categories !== void 0) {
      let data7 = data.categories;
      if (Array.isArray(data7)) {
        if (data7.length > 2e3) {
          const err26 = {
            instancePath: instancePath + "/categories",
            schemaPath: "#/properties/categories/maxItems",
            keyword: "maxItems",
            params: { limit: 2e3 },
            message: "must NOT have more than 2000 items",
          };
          if (vErrors === null) {
            vErrors = [err26];
          } else {
            vErrors.push(err26);
          }
          errors++;
        }
        const len0 = data7.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !validate40(data7[i0], {
              instancePath: instancePath + "/categories/" + i0,
              parentData: data7,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate40.errors : vErrors.concat(validate40.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/categories",
          schemaPath: "#/properties/categories/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.merchants !== void 0) {
      let data9 = data.merchants;
      if (Array.isArray(data9)) {
        if (data9.length > 5e4) {
          const err28 = {
            instancePath: instancePath + "/merchants",
            schemaPath: "#/properties/merchants/maxItems",
            keyword: "maxItems",
            params: { limit: 5e4 },
            message: "must NOT have more than 50000 items",
          };
          if (vErrors === null) {
            vErrors = [err28];
          } else {
            vErrors.push(err28);
          }
          errors++;
        }
        const len1 = data9.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !validate48(data9[i1], {
              instancePath: instancePath + "/merchants/" + i1,
              parentData: data9,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate48.errors : vErrors.concat(validate48.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err29 = {
          instancePath: instancePath + "/merchants",
          schemaPath: "#/properties/merchants/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err29];
        } else {
          vErrors.push(err29);
        }
        errors++;
      }
    }
    if (data.rules !== void 0) {
      let data11 = data.rules;
      if (Array.isArray(data11)) {
        if (data11.length > 5e4) {
          const err30 = {
            instancePath: instancePath + "/rules",
            schemaPath: "#/properties/rules/maxItems",
            keyword: "maxItems",
            params: { limit: 5e4 },
            message: "must NOT have more than 50000 items",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
        const len2 = data11.length;
        for (let i2 = 0; i2 < len2; i2++) {
          if (
            !validate52(data11[i2], {
              instancePath: instancePath + "/rules/" + i2,
              parentData: data11,
              parentDataProperty: i2,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate52.errors : vErrors.concat(validate52.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err31 = {
          instancePath: instancePath + "/rules",
          schemaPath: "#/properties/rules/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err31];
        } else {
          vErrors.push(err31);
        }
        errors++;
      }
    }
    if (data.recurringDecisions !== void 0) {
      let data13 = data.recurringDecisions;
      if (Array.isArray(data13)) {
        if (data13.length > 1e4) {
          const err32 = {
            instancePath: instancePath + "/recurringDecisions",
            schemaPath: "#/properties/recurringDecisions/maxItems",
            keyword: "maxItems",
            params: { limit: 1e4 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
        const len3 = data13.length;
        for (let i3 = 0; i3 < len3; i3++) {
          if (
            !validate56(data13[i3], {
              instancePath: instancePath + "/recurringDecisions/" + i3,
              parentData: data13,
              parentDataProperty: i3,
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate56.errors : vErrors.concat(validate56.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err33 = {
          instancePath: instancePath + "/recurringDecisions",
          schemaPath: "#/properties/recurringDecisions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
    if (data.preferences !== void 0) {
      if (
        !validate58(data.preferences, {
          instancePath: instancePath + "/preferences",
          parentData: data,
          parentDataProperty: "preferences",
          rootData,
          dynamicAnchors,
        })
      ) {
        vErrors = vErrors === null ? validate58.errors : vErrors.concat(validate58.errors);
        errors = vErrors.length;
      }
    }
    if (data.extensions !== void 0) {
      let data16 = data.extensions;
      if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
        if (Object.keys(data16).length > 100) {
          const err34 = {
            instancePath: instancePath + "/extensions",
            schemaPath: "#/properties/extensions/maxProperties",
            keyword: "maxProperties",
            params: { limit: 100 },
            message: "must NOT have more than 100 properties",
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        for (const key2 in data16) {
          const _errs33 = errors;
          if (typeof key2 === "string") {
            if (!pattern13.test(key2)) {
              const err35 = {
                instancePath: instancePath + "/extensions",
                schemaPath: "#/properties/extensions/propertyNames/pattern",
                keyword: "pattern",
                params: { pattern: "^[a-z][a-z0-9]*(?:\\.[a-z0-9-]+)+$" },
                message: 'must match pattern "^[a-z][a-z0-9]*(?:\\.[a-z0-9-]+)+$"',
                propertyName: key2,
              };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
          }
          var valid13 = _errs33 === errors;
          if (!valid13) {
            const err36 = {
              instancePath: instancePath + "/extensions",
              schemaPath: "#/properties/extensions/propertyNames",
              keyword: "propertyNames",
              params: { propertyName: key2 },
              message: "property name must be valid",
            };
            if (vErrors === null) {
              vErrors = [err36];
            } else {
              vErrors.push(err36);
            }
            errors++;
          }
        }
      } else {
        const err37 = {
          instancePath: instancePath + "/extensions",
          schemaPath: "#/properties/extensions/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err37];
        } else {
          vErrors.push(err37);
        }
        errors++;
      }
    }
  } else {
    const err38 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err38];
    } else {
      vErrors.push(err38);
    }
    errors++;
  }
  validate46.errors = vErrors;
  return errors === 0;
}
validate46.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var validateImportSchema = validate60;
var schema111 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://financial-intelligence.local/schemas/import.schema.json",
  title: "Statement Import",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "id",
    "accountId",
    "source",
    "parser",
    "status",
    "mapping",
    "counts",
    "issues",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    schemaVersion: { const: "1.0.0" },
    id: { $ref: "#/$defs/uuid" },
    accountId: { $ref: "#/$defs/uuid" },
    source: { $ref: "#/$defs/source" },
    parser: { $ref: "#/$defs/parser" },
    status: {
      enum: ["staged", "ready", "committing", "committed", "failed", "cancelled", "deleted"],
    },
    mapping: {
      type: "object",
      additionalProperties: { type: ["string", "number", "boolean", "null"] },
      maxProperties: 60,
    },
    counts: { $ref: "#/$defs/counts" },
    issues: { type: "array", maxItems: 1e4, items: { $ref: "#/$defs/issue" } },
    committedRevision: { type: "integer", minimum: 1 },
    createdAt: { $ref: "#/$defs/dateTime" },
    updatedAt: { $ref: "#/$defs/dateTime" },
    committedAt: { $ref: "#/$defs/dateTime" },
  },
  $defs: {
    uuid: { type: "string", format: "uuid" },
    dateTime: { type: "string", format: "date-time" },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["fileName", "mediaType", "byteSize", "sha256", "retained"],
      properties: {
        fileName: { type: "string", minLength: 1, maxLength: 255 },
        mediaType: { type: "string", minLength: 1, maxLength: 120 },
        byteSize: { type: "integer", minimum: 0 },
        sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
        retained: { type: "boolean" },
      },
    },
    parser: {
      type: "object",
      additionalProperties: false,
      required: ["id", "version"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 100 },
        version: { type: "string", minLength: 1, maxLength: 40 },
      },
    },
    counts: {
      type: "object",
      additionalProperties: false,
      required: [
        "sourceRows",
        "valid",
        "errors",
        "warnings",
        "exactDuplicates",
        "likelyDuplicates",
        "committed",
      ],
      properties: {
        sourceRows: { type: "integer", minimum: 0 },
        valid: { type: "integer", minimum: 0 },
        errors: { type: "integer", minimum: 0 },
        warnings: { type: "integer", minimum: 0 },
        exactDuplicates: { type: "integer", minimum: 0 },
        likelyDuplicates: { type: "integer", minimum: 0 },
        committed: { type: "integer", minimum: 0 },
      },
    },
    issue: {
      type: "object",
      additionalProperties: false,
      required: ["code", "severity", "message"],
      properties: {
        code: { type: "string", pattern: "^[A-Z][A-Z0-9_]{2,63}$" },
        severity: { enum: ["error", "warning", "information"] },
        sourceLocation: { type: "string", maxLength: 160 },
        field: { type: "string", maxLength: 80 },
        message: { type: "string", minLength: 1, maxLength: 500 },
      },
    },
  },
};
var schema117 = {
  type: "object",
  additionalProperties: false,
  required: ["code", "severity", "message"],
  properties: {
    code: { type: "string", pattern: "^[A-Z][A-Z0-9_]{2,63}$" },
    severity: { enum: ["error", "warning", "information"] },
    sourceLocation: { type: "string", maxLength: 160 },
    field: { type: "string", maxLength: 80 },
    message: { type: "string", minLength: 1, maxLength: 500 },
  },
};
var pattern15 = new RegExp("^[A-Z][A-Z0-9_]{2,63}$", "u");
function validate60(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate60.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property 'schemaVersion'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.accountId === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "accountId" },
        message: "must have required property 'accountId'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.source === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "source" },
        message: "must have required property 'source'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.parser === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "parser" },
        message: "must have required property 'parser'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.status === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "status" },
        message: "must have required property 'status'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.mapping === void 0) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "mapping" },
        message: "must have required property 'mapping'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.counts === void 0) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "counts" },
        message: "must have required property 'counts'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.issues === void 0) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "issues" },
        message: "must have required property 'issues'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema111.properties, key0)) {
        const err11 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      if ("1.0.0" !== data.schemaVersion) {
        const err12 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "1.0.0" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (!formats0.test(data1)) {
          const err13 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err13];
          } else {
            vErrors.push(err13);
          }
          errors++;
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.accountId !== void 0) {
      let data2 = data.accountId;
      if (typeof data2 === "string") {
        if (!formats0.test(data2)) {
          const err15 = {
            instancePath: instancePath + "/accountId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/accountId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.source !== void 0) {
      let data3 = data.source;
      if (data3 && typeof data3 == "object" && !Array.isArray(data3)) {
        if (data3.fileName === void 0) {
          const err17 = {
            instancePath: instancePath + "/source",
            schemaPath: "#/$defs/source/required",
            keyword: "required",
            params: { missingProperty: "fileName" },
            message: "must have required property 'fileName'",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        if (data3.mediaType === void 0) {
          const err18 = {
            instancePath: instancePath + "/source",
            schemaPath: "#/$defs/source/required",
            keyword: "required",
            params: { missingProperty: "mediaType" },
            message: "must have required property 'mediaType'",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
        if (data3.byteSize === void 0) {
          const err19 = {
            instancePath: instancePath + "/source",
            schemaPath: "#/$defs/source/required",
            keyword: "required",
            params: { missingProperty: "byteSize" },
            message: "must have required property 'byteSize'",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
        if (data3.sha256 === void 0) {
          const err20 = {
            instancePath: instancePath + "/source",
            schemaPath: "#/$defs/source/required",
            keyword: "required",
            params: { missingProperty: "sha256" },
            message: "must have required property 'sha256'",
          };
          if (vErrors === null) {
            vErrors = [err20];
          } else {
            vErrors.push(err20);
          }
          errors++;
        }
        if (data3.retained === void 0) {
          const err21 = {
            instancePath: instancePath + "/source",
            schemaPath: "#/$defs/source/required",
            keyword: "required",
            params: { missingProperty: "retained" },
            message: "must have required property 'retained'",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
        for (const key1 in data3) {
          if (!(
            key1 === "fileName" ||
            key1 === "mediaType" ||
            key1 === "byteSize" ||
            key1 === "sha256" ||
            key1 === "retained"
          )) {
            const err22 = {
              instancePath: instancePath + "/source",
              schemaPath: "#/$defs/source/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err22];
            } else {
              vErrors.push(err22);
            }
            errors++;
          }
        }
        if (data3.fileName !== void 0) {
          let data4 = data3.fileName;
          if (typeof data4 === "string") {
            if (func2(data4) > 255) {
              const err23 = {
                instancePath: instancePath + "/source/fileName",
                schemaPath: "#/$defs/source/properties/fileName/maxLength",
                keyword: "maxLength",
                params: { limit: 255 },
                message: "must NOT have more than 255 characters",
              };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
            if (func2(data4) < 1) {
              const err24 = {
                instancePath: instancePath + "/source/fileName",
                schemaPath: "#/$defs/source/properties/fileName/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err24];
              } else {
                vErrors.push(err24);
              }
              errors++;
            }
          } else {
            const err25 = {
              instancePath: instancePath + "/source/fileName",
              schemaPath: "#/$defs/source/properties/fileName/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data3.mediaType !== void 0) {
          let data5 = data3.mediaType;
          if (typeof data5 === "string") {
            if (func2(data5) > 120) {
              const err26 = {
                instancePath: instancePath + "/source/mediaType",
                schemaPath: "#/$defs/source/properties/mediaType/maxLength",
                keyword: "maxLength",
                params: { limit: 120 },
                message: "must NOT have more than 120 characters",
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
            if (func2(data5) < 1) {
              const err27 = {
                instancePath: instancePath + "/source/mediaType",
                schemaPath: "#/$defs/source/properties/mediaType/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
          } else {
            const err28 = {
              instancePath: instancePath + "/source/mediaType",
              schemaPath: "#/$defs/source/properties/mediaType/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err28];
            } else {
              vErrors.push(err28);
            }
            errors++;
          }
        }
        if (data3.byteSize !== void 0) {
          let data6 = data3.byteSize;
          if (!(typeof data6 == "number" && !(data6 % 1) && !isNaN(data6) && isFinite(data6))) {
            const err29 = {
              instancePath: instancePath + "/source/byteSize",
              schemaPath: "#/$defs/source/properties/byteSize/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err29];
            } else {
              vErrors.push(err29);
            }
            errors++;
          }
          if (typeof data6 == "number" && isFinite(data6)) {
            if (data6 < 0 || isNaN(data6)) {
              const err30 = {
                instancePath: instancePath + "/source/byteSize",
                schemaPath: "#/$defs/source/properties/byteSize/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err30];
              } else {
                vErrors.push(err30);
              }
              errors++;
            }
          }
        }
        if (data3.sha256 !== void 0) {
          let data7 = data3.sha256;
          if (typeof data7 === "string") {
            if (!pattern5.test(data7)) {
              const err31 = {
                instancePath: instancePath + "/source/sha256",
                schemaPath: "#/$defs/source/properties/sha256/pattern",
                keyword: "pattern",
                params: { pattern: "^[0-9a-f]{64}$" },
                message: 'must match pattern "^[0-9a-f]{64}$"',
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
          } else {
            const err32 = {
              instancePath: instancePath + "/source/sha256",
              schemaPath: "#/$defs/source/properties/sha256/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
        if (data3.retained !== void 0) {
          if (typeof data3.retained !== "boolean") {
            const err33 = {
              instancePath: instancePath + "/source/retained",
              schemaPath: "#/$defs/source/properties/retained/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err33];
            } else {
              vErrors.push(err33);
            }
            errors++;
          }
        }
      } else {
        const err34 = {
          instancePath: instancePath + "/source",
          schemaPath: "#/$defs/source/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err34];
        } else {
          vErrors.push(err34);
        }
        errors++;
      }
    }
    if (data.parser !== void 0) {
      let data9 = data.parser;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        if (data9.id === void 0) {
          const err35 = {
            instancePath: instancePath + "/parser",
            schemaPath: "#/$defs/parser/required",
            keyword: "required",
            params: { missingProperty: "id" },
            message: "must have required property 'id'",
          };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
        if (data9.version === void 0) {
          const err36 = {
            instancePath: instancePath + "/parser",
            schemaPath: "#/$defs/parser/required",
            keyword: "required",
            params: { missingProperty: "version" },
            message: "must have required property 'version'",
          };
          if (vErrors === null) {
            vErrors = [err36];
          } else {
            vErrors.push(err36);
          }
          errors++;
        }
        for (const key2 in data9) {
          if (!(key2 === "id" || key2 === "version")) {
            const err37 = {
              instancePath: instancePath + "/parser",
              schemaPath: "#/$defs/parser/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
        if (data9.id !== void 0) {
          let data10 = data9.id;
          if (typeof data10 === "string") {
            if (func2(data10) > 100) {
              const err38 = {
                instancePath: instancePath + "/parser/id",
                schemaPath: "#/$defs/parser/properties/id/maxLength",
                keyword: "maxLength",
                params: { limit: 100 },
                message: "must NOT have more than 100 characters",
              };
              if (vErrors === null) {
                vErrors = [err38];
              } else {
                vErrors.push(err38);
              }
              errors++;
            }
            if (func2(data10) < 1) {
              const err39 = {
                instancePath: instancePath + "/parser/id",
                schemaPath: "#/$defs/parser/properties/id/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err39];
              } else {
                vErrors.push(err39);
              }
              errors++;
            }
          } else {
            const err40 = {
              instancePath: instancePath + "/parser/id",
              schemaPath: "#/$defs/parser/properties/id/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err40];
            } else {
              vErrors.push(err40);
            }
            errors++;
          }
        }
        if (data9.version !== void 0) {
          let data11 = data9.version;
          if (typeof data11 === "string") {
            if (func2(data11) > 40) {
              const err41 = {
                instancePath: instancePath + "/parser/version",
                schemaPath: "#/$defs/parser/properties/version/maxLength",
                keyword: "maxLength",
                params: { limit: 40 },
                message: "must NOT have more than 40 characters",
              };
              if (vErrors === null) {
                vErrors = [err41];
              } else {
                vErrors.push(err41);
              }
              errors++;
            }
            if (func2(data11) < 1) {
              const err42 = {
                instancePath: instancePath + "/parser/version",
                schemaPath: "#/$defs/parser/properties/version/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
          } else {
            const err43 = {
              instancePath: instancePath + "/parser/version",
              schemaPath: "#/$defs/parser/properties/version/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
      } else {
        const err44 = {
          instancePath: instancePath + "/parser",
          schemaPath: "#/$defs/parser/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err44];
        } else {
          vErrors.push(err44);
        }
        errors++;
      }
    }
    if (data.status !== void 0) {
      let data12 = data.status;
      if (!(
        data12 === "staged" ||
        data12 === "ready" ||
        data12 === "committing" ||
        data12 === "committed" ||
        data12 === "failed" ||
        data12 === "cancelled" ||
        data12 === "deleted"
      )) {
        const err45 = {
          instancePath: instancePath + "/status",
          schemaPath: "#/properties/status/enum",
          keyword: "enum",
          params: { allowedValues: schema111.properties.status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err45];
        } else {
          vErrors.push(err45);
        }
        errors++;
      }
    }
    if (data.mapping !== void 0) {
      let data13 = data.mapping;
      if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
        if (Object.keys(data13).length > 60) {
          const err46 = {
            instancePath: instancePath + "/mapping",
            schemaPath: "#/properties/mapping/maxProperties",
            keyword: "maxProperties",
            params: { limit: 60 },
            message: "must NOT have more than 60 properties",
          };
          if (vErrors === null) {
            vErrors = [err46];
          } else {
            vErrors.push(err46);
          }
          errors++;
        }
        for (const key3 in data13) {
          let data14 = data13[key3];
          if (
            typeof data14 !== "string" &&
            !(typeof data14 == "number" && isFinite(data14)) &&
            typeof data14 !== "boolean" &&
            data14 !== null
          ) {
            const err47 = {
              instancePath:
                instancePath + "/mapping/" + key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath: "#/properties/mapping/additionalProperties/type",
              keyword: "type",
              params: { type: schema111.properties.mapping.additionalProperties.type },
              message: "must be string,number,boolean,null",
            };
            if (vErrors === null) {
              vErrors = [err47];
            } else {
              vErrors.push(err47);
            }
            errors++;
          }
        }
      } else {
        const err48 = {
          instancePath: instancePath + "/mapping",
          schemaPath: "#/properties/mapping/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err48];
        } else {
          vErrors.push(err48);
        }
        errors++;
      }
    }
    if (data.counts !== void 0) {
      let data15 = data.counts;
      if (data15 && typeof data15 == "object" && !Array.isArray(data15)) {
        if (data15.sourceRows === void 0) {
          const err49 = {
            instancePath: instancePath + "/counts",
            schemaPath: "#/$defs/counts/required",
            keyword: "required",
            params: { missingProperty: "sourceRows" },
            message: "must have required property 'sourceRows'",
          };
          if (vErrors === null) {
            vErrors = [err49];
          } else {
            vErrors.push(err49);
          }
          errors++;
        }
        if (data15.valid === void 0) {
          const err50 = {
            instancePath: instancePath + "/counts",
            schemaPath: "#/$defs/counts/required",
            keyword: "required",
            params: { missingProperty: "valid" },
            message: "must have required property 'valid'",
          };
          if (vErrors === null) {
            vErrors = [err50];
          } else {
            vErrors.push(err50);
          }
          errors++;
        }
        if (data15.errors === void 0) {
          const err51 = {
            instancePath: instancePath + "/counts",
            schemaPath: "#/$defs/counts/required",
            keyword: "required",
            params: { missingProperty: "errors" },
            message: "must have required property 'errors'",
          };
          if (vErrors === null) {
            vErrors = [err51];
          } else {
            vErrors.push(err51);
          }
          errors++;
        }
        if (data15.warnings === void 0) {
          const err52 = {
            instancePath: instancePath + "/counts",
            schemaPath: "#/$defs/counts/required",
            keyword: "required",
            params: { missingProperty: "warnings" },
            message: "must have required property 'warnings'",
          };
          if (vErrors === null) {
            vErrors = [err52];
          } else {
            vErrors.push(err52);
          }
          errors++;
        }
        if (data15.exactDuplicates === void 0) {
          const err53 = {
            instancePath: instancePath + "/counts",
            schemaPath: "#/$defs/counts/required",
            keyword: "required",
            params: { missingProperty: "exactDuplicates" },
            message: "must have required property 'exactDuplicates'",
          };
          if (vErrors === null) {
            vErrors = [err53];
          } else {
            vErrors.push(err53);
          }
          errors++;
        }
        if (data15.likelyDuplicates === void 0) {
          const err54 = {
            instancePath: instancePath + "/counts",
            schemaPath: "#/$defs/counts/required",
            keyword: "required",
            params: { missingProperty: "likelyDuplicates" },
            message: "must have required property 'likelyDuplicates'",
          };
          if (vErrors === null) {
            vErrors = [err54];
          } else {
            vErrors.push(err54);
          }
          errors++;
        }
        if (data15.committed === void 0) {
          const err55 = {
            instancePath: instancePath + "/counts",
            schemaPath: "#/$defs/counts/required",
            keyword: "required",
            params: { missingProperty: "committed" },
            message: "must have required property 'committed'",
          };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        for (const key4 in data15) {
          if (!(
            key4 === "sourceRows" ||
            key4 === "valid" ||
            key4 === "errors" ||
            key4 === "warnings" ||
            key4 === "exactDuplicates" ||
            key4 === "likelyDuplicates" ||
            key4 === "committed"
          )) {
            const err56 = {
              instancePath: instancePath + "/counts",
              schemaPath: "#/$defs/counts/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err56];
            } else {
              vErrors.push(err56);
            }
            errors++;
          }
        }
        if (data15.sourceRows !== void 0) {
          let data16 = data15.sourceRows;
          if (!(typeof data16 == "number" && !(data16 % 1) && !isNaN(data16) && isFinite(data16))) {
            const err57 = {
              instancePath: instancePath + "/counts/sourceRows",
              schemaPath: "#/$defs/counts/properties/sourceRows/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err57];
            } else {
              vErrors.push(err57);
            }
            errors++;
          }
          if (typeof data16 == "number" && isFinite(data16)) {
            if (data16 < 0 || isNaN(data16)) {
              const err58 = {
                instancePath: instancePath + "/counts/sourceRows",
                schemaPath: "#/$defs/counts/properties/sourceRows/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err58];
              } else {
                vErrors.push(err58);
              }
              errors++;
            }
          }
        }
        if (data15.valid !== void 0) {
          let data17 = data15.valid;
          if (!(typeof data17 == "number" && !(data17 % 1) && !isNaN(data17) && isFinite(data17))) {
            const err59 = {
              instancePath: instancePath + "/counts/valid",
              schemaPath: "#/$defs/counts/properties/valid/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
          if (typeof data17 == "number" && isFinite(data17)) {
            if (data17 < 0 || isNaN(data17)) {
              const err60 = {
                instancePath: instancePath + "/counts/valid",
                schemaPath: "#/$defs/counts/properties/valid/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err60];
              } else {
                vErrors.push(err60);
              }
              errors++;
            }
          }
        }
        if (data15.errors !== void 0) {
          let data18 = data15.errors;
          if (!(typeof data18 == "number" && !(data18 % 1) && !isNaN(data18) && isFinite(data18))) {
            const err61 = {
              instancePath: instancePath + "/counts/errors",
              schemaPath: "#/$defs/counts/properties/errors/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err61];
            } else {
              vErrors.push(err61);
            }
            errors++;
          }
          if (typeof data18 == "number" && isFinite(data18)) {
            if (data18 < 0 || isNaN(data18)) {
              const err62 = {
                instancePath: instancePath + "/counts/errors",
                schemaPath: "#/$defs/counts/properties/errors/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err62];
              } else {
                vErrors.push(err62);
              }
              errors++;
            }
          }
        }
        if (data15.warnings !== void 0) {
          let data19 = data15.warnings;
          if (!(typeof data19 == "number" && !(data19 % 1) && !isNaN(data19) && isFinite(data19))) {
            const err63 = {
              instancePath: instancePath + "/counts/warnings",
              schemaPath: "#/$defs/counts/properties/warnings/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err63];
            } else {
              vErrors.push(err63);
            }
            errors++;
          }
          if (typeof data19 == "number" && isFinite(data19)) {
            if (data19 < 0 || isNaN(data19)) {
              const err64 = {
                instancePath: instancePath + "/counts/warnings",
                schemaPath: "#/$defs/counts/properties/warnings/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
          }
        }
        if (data15.exactDuplicates !== void 0) {
          let data20 = data15.exactDuplicates;
          if (!(typeof data20 == "number" && !(data20 % 1) && !isNaN(data20) && isFinite(data20))) {
            const err65 = {
              instancePath: instancePath + "/counts/exactDuplicates",
              schemaPath: "#/$defs/counts/properties/exactDuplicates/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err65];
            } else {
              vErrors.push(err65);
            }
            errors++;
          }
          if (typeof data20 == "number" && isFinite(data20)) {
            if (data20 < 0 || isNaN(data20)) {
              const err66 = {
                instancePath: instancePath + "/counts/exactDuplicates",
                schemaPath: "#/$defs/counts/properties/exactDuplicates/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err66];
              } else {
                vErrors.push(err66);
              }
              errors++;
            }
          }
        }
        if (data15.likelyDuplicates !== void 0) {
          let data21 = data15.likelyDuplicates;
          if (!(typeof data21 == "number" && !(data21 % 1) && !isNaN(data21) && isFinite(data21))) {
            const err67 = {
              instancePath: instancePath + "/counts/likelyDuplicates",
              schemaPath: "#/$defs/counts/properties/likelyDuplicates/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err67];
            } else {
              vErrors.push(err67);
            }
            errors++;
          }
          if (typeof data21 == "number" && isFinite(data21)) {
            if (data21 < 0 || isNaN(data21)) {
              const err68 = {
                instancePath: instancePath + "/counts/likelyDuplicates",
                schemaPath: "#/$defs/counts/properties/likelyDuplicates/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err68];
              } else {
                vErrors.push(err68);
              }
              errors++;
            }
          }
        }
        if (data15.committed !== void 0) {
          let data22 = data15.committed;
          if (!(typeof data22 == "number" && !(data22 % 1) && !isNaN(data22) && isFinite(data22))) {
            const err69 = {
              instancePath: instancePath + "/counts/committed",
              schemaPath: "#/$defs/counts/properties/committed/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            if (vErrors === null) {
              vErrors = [err69];
            } else {
              vErrors.push(err69);
            }
            errors++;
          }
          if (typeof data22 == "number" && isFinite(data22)) {
            if (data22 < 0 || isNaN(data22)) {
              const err70 = {
                instancePath: instancePath + "/counts/committed",
                schemaPath: "#/$defs/counts/properties/committed/minimum",
                keyword: "minimum",
                params: { comparison: ">=", limit: 0 },
                message: "must be >= 0",
              };
              if (vErrors === null) {
                vErrors = [err70];
              } else {
                vErrors.push(err70);
              }
              errors++;
            }
          }
        }
      } else {
        const err71 = {
          instancePath: instancePath + "/counts",
          schemaPath: "#/$defs/counts/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err71];
        } else {
          vErrors.push(err71);
        }
        errors++;
      }
    }
    if (data.issues !== void 0) {
      let data23 = data.issues;
      if (Array.isArray(data23)) {
        if (data23.length > 1e4) {
          const err72 = {
            instancePath: instancePath + "/issues",
            schemaPath: "#/properties/issues/maxItems",
            keyword: "maxItems",
            params: { limit: 1e4 },
            message: "must NOT have more than 10000 items",
          };
          if (vErrors === null) {
            vErrors = [err72];
          } else {
            vErrors.push(err72);
          }
          errors++;
        }
        const len0 = data23.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data24 = data23[i0];
          if (data24 && typeof data24 == "object" && !Array.isArray(data24)) {
            if (data24.code === void 0) {
              const err73 = {
                instancePath: instancePath + "/issues/" + i0,
                schemaPath: "#/$defs/issue/required",
                keyword: "required",
                params: { missingProperty: "code" },
                message: "must have required property 'code'",
              };
              if (vErrors === null) {
                vErrors = [err73];
              } else {
                vErrors.push(err73);
              }
              errors++;
            }
            if (data24.severity === void 0) {
              const err74 = {
                instancePath: instancePath + "/issues/" + i0,
                schemaPath: "#/$defs/issue/required",
                keyword: "required",
                params: { missingProperty: "severity" },
                message: "must have required property 'severity'",
              };
              if (vErrors === null) {
                vErrors = [err74];
              } else {
                vErrors.push(err74);
              }
              errors++;
            }
            if (data24.message === void 0) {
              const err75 = {
                instancePath: instancePath + "/issues/" + i0,
                schemaPath: "#/$defs/issue/required",
                keyword: "required",
                params: { missingProperty: "message" },
                message: "must have required property 'message'",
              };
              if (vErrors === null) {
                vErrors = [err75];
              } else {
                vErrors.push(err75);
              }
              errors++;
            }
            for (const key5 in data24) {
              if (!(
                key5 === "code" ||
                key5 === "severity" ||
                key5 === "sourceLocation" ||
                key5 === "field" ||
                key5 === "message"
              )) {
                const err76 = {
                  instancePath: instancePath + "/issues/" + i0,
                  schemaPath: "#/$defs/issue/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key5 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err76];
                } else {
                  vErrors.push(err76);
                }
                errors++;
              }
            }
            if (data24.code !== void 0) {
              let data25 = data24.code;
              if (typeof data25 === "string") {
                if (!pattern15.test(data25)) {
                  const err77 = {
                    instancePath: instancePath + "/issues/" + i0 + "/code",
                    schemaPath: "#/$defs/issue/properties/code/pattern",
                    keyword: "pattern",
                    params: { pattern: "^[A-Z][A-Z0-9_]{2,63}$" },
                    message: 'must match pattern "^[A-Z][A-Z0-9_]{2,63}$"',
                  };
                  if (vErrors === null) {
                    vErrors = [err77];
                  } else {
                    vErrors.push(err77);
                  }
                  errors++;
                }
              } else {
                const err78 = {
                  instancePath: instancePath + "/issues/" + i0 + "/code",
                  schemaPath: "#/$defs/issue/properties/code/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err78];
                } else {
                  vErrors.push(err78);
                }
                errors++;
              }
            }
            if (data24.severity !== void 0) {
              let data26 = data24.severity;
              if (!(data26 === "error" || data26 === "warning" || data26 === "information")) {
                const err79 = {
                  instancePath: instancePath + "/issues/" + i0 + "/severity",
                  schemaPath: "#/$defs/issue/properties/severity/enum",
                  keyword: "enum",
                  params: { allowedValues: schema117.properties.severity.enum },
                  message: "must be equal to one of the allowed values",
                };
                if (vErrors === null) {
                  vErrors = [err79];
                } else {
                  vErrors.push(err79);
                }
                errors++;
              }
            }
            if (data24.sourceLocation !== void 0) {
              let data27 = data24.sourceLocation;
              if (typeof data27 === "string") {
                if (func2(data27) > 160) {
                  const err80 = {
                    instancePath: instancePath + "/issues/" + i0 + "/sourceLocation",
                    schemaPath: "#/$defs/issue/properties/sourceLocation/maxLength",
                    keyword: "maxLength",
                    params: { limit: 160 },
                    message: "must NOT have more than 160 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err80];
                  } else {
                    vErrors.push(err80);
                  }
                  errors++;
                }
              } else {
                const err81 = {
                  instancePath: instancePath + "/issues/" + i0 + "/sourceLocation",
                  schemaPath: "#/$defs/issue/properties/sourceLocation/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err81];
                } else {
                  vErrors.push(err81);
                }
                errors++;
              }
            }
            if (data24.field !== void 0) {
              let data28 = data24.field;
              if (typeof data28 === "string") {
                if (func2(data28) > 80) {
                  const err82 = {
                    instancePath: instancePath + "/issues/" + i0 + "/field",
                    schemaPath: "#/$defs/issue/properties/field/maxLength",
                    keyword: "maxLength",
                    params: { limit: 80 },
                    message: "must NOT have more than 80 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err82];
                  } else {
                    vErrors.push(err82);
                  }
                  errors++;
                }
              } else {
                const err83 = {
                  instancePath: instancePath + "/issues/" + i0 + "/field",
                  schemaPath: "#/$defs/issue/properties/field/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err83];
                } else {
                  vErrors.push(err83);
                }
                errors++;
              }
            }
            if (data24.message !== void 0) {
              let data29 = data24.message;
              if (typeof data29 === "string") {
                if (func2(data29) > 500) {
                  const err84 = {
                    instancePath: instancePath + "/issues/" + i0 + "/message",
                    schemaPath: "#/$defs/issue/properties/message/maxLength",
                    keyword: "maxLength",
                    params: { limit: 500 },
                    message: "must NOT have more than 500 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err84];
                  } else {
                    vErrors.push(err84);
                  }
                  errors++;
                }
                if (func2(data29) < 1) {
                  const err85 = {
                    instancePath: instancePath + "/issues/" + i0 + "/message",
                    schemaPath: "#/$defs/issue/properties/message/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err85];
                  } else {
                    vErrors.push(err85);
                  }
                  errors++;
                }
              } else {
                const err86 = {
                  instancePath: instancePath + "/issues/" + i0 + "/message",
                  schemaPath: "#/$defs/issue/properties/message/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err86];
                } else {
                  vErrors.push(err86);
                }
                errors++;
              }
            }
          } else {
            const err87 = {
              instancePath: instancePath + "/issues/" + i0,
              schemaPath: "#/$defs/issue/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err87];
            } else {
              vErrors.push(err87);
            }
            errors++;
          }
        }
      } else {
        const err88 = {
          instancePath: instancePath + "/issues",
          schemaPath: "#/properties/issues/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err88];
        } else {
          vErrors.push(err88);
        }
        errors++;
      }
    }
    if (data.committedRevision !== void 0) {
      let data30 = data.committedRevision;
      if (!(typeof data30 == "number" && !(data30 % 1) && !isNaN(data30) && isFinite(data30))) {
        const err89 = {
          instancePath: instancePath + "/committedRevision",
          schemaPath: "#/properties/committedRevision/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err89];
        } else {
          vErrors.push(err89);
        }
        errors++;
      }
      if (typeof data30 == "number" && isFinite(data30)) {
        if (data30 < 1 || isNaN(data30)) {
          const err90 = {
            instancePath: instancePath + "/committedRevision",
            schemaPath: "#/properties/committedRevision/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 1 },
            message: "must be >= 1",
          };
          if (vErrors === null) {
            vErrors = [err90];
          } else {
            vErrors.push(err90);
          }
          errors++;
        }
      }
    }
    if (data.createdAt !== void 0) {
      let data31 = data.createdAt;
      if (typeof data31 === "string") {
        if (!formats4.validate(data31)) {
          const err91 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err91];
          } else {
            vErrors.push(err91);
          }
          errors++;
        }
      } else {
        const err92 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err92];
        } else {
          vErrors.push(err92);
        }
        errors++;
      }
    }
    if (data.updatedAt !== void 0) {
      let data32 = data.updatedAt;
      if (typeof data32 === "string") {
        if (!formats4.validate(data32)) {
          const err93 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err93];
          } else {
            vErrors.push(err93);
          }
          errors++;
        }
      } else {
        const err94 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err94];
        } else {
          vErrors.push(err94);
        }
        errors++;
      }
    }
    if (data.committedAt !== void 0) {
      let data33 = data.committedAt;
      if (typeof data33 === "string") {
        if (!formats4.validate(data33)) {
          const err95 = {
            instancePath: instancePath + "/committedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err95];
          } else {
            vErrors.push(err95);
          }
          errors++;
        }
      } else {
        const err96 = {
          instancePath: instancePath + "/committedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err96];
        } else {
          vErrors.push(err96);
        }
        errors++;
      }
    }
  } else {
    const err97 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err97];
    } else {
      vErrors.push(err97);
    }
    errors++;
  }
  validate60.errors = vErrors;
  return errors === 0;
}
validate60.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
var validateMerchantSchema = validate48;
var validateTransactionSchema = validate61;
var schema121 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://financial-intelligence.local/schemas/transaction.schema.json",
  title: "Canonical Transaction",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "id",
    "accountId",
    "importId",
    "postedDate",
    "amount",
    "currency",
    "description",
    "status",
    "reviewState",
    "tags",
    "provenance",
    "classifications",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    schemaVersion: { const: "1.0.0" },
    id: { $ref: "#/$defs/uuid" },
    accountId: { $ref: "#/$defs/uuid" },
    importId: { $ref: "#/$defs/uuid" },
    postedDate: { $ref: "#/$defs/date" },
    transactionDate: { $ref: "#/$defs/date" },
    amount: { $ref: "#/$defs/decimal" },
    currency: { $ref: "#/$defs/currency" },
    description: { type: "string", minLength: 1, maxLength: 1e3 },
    sourceTransactionId: { type: "string", minLength: 1, maxLength: 240 },
    merchantId: { $ref: "#/$defs/uuid" },
    categoryId: { $ref: "#/$defs/uuid" },
    tags: {
      type: "array",
      maxItems: 50,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: 60 },
    },
    notes: { type: "string", maxLength: 2e3 },
    status: { enum: ["pending", "posted", "void"] },
    reviewState: { enum: ["unreviewed", "needsReview", "reviewed"] },
    transferLinkId: { $ref: "#/$defs/uuid" },
    classifications: {
      type: "object",
      additionalProperties: false,
      properties: {
        merchant: { $ref: "#/$defs/classification" },
        category: { $ref: "#/$defs/classification" },
      },
    },
    provenance: { $ref: "#/$defs/provenance" },
    createdAt: { $ref: "#/$defs/dateTime" },
    updatedAt: { $ref: "#/$defs/dateTime" },
  },
  $defs: {
    uuid: { type: "string", format: "uuid" },
    date: { type: "string", format: "date" },
    dateTime: { type: "string", format: "date-time" },
    decimal: { type: "string", pattern: "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
    classification: {
      type: "object",
      additionalProperties: false,
      required: ["method", "classifierId", "classifierVersion", "evidence", "locked", "decidedAt"],
      properties: {
        method: {
          enum: ["user", "imported", "rule", "merchantMapping", "heuristic", "localAi", "remoteAi"],
        },
        classifierId: { type: "string", minLength: 1, maxLength: 100 },
        classifierVersion: { type: "string", minLength: 1, maxLength: 40 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        evidence: {
          type: "array",
          maxItems: 20,
          items: { type: "string", minLength: 1, maxLength: 160 },
        },
        locked: { type: "boolean" },
        decidedAt: { $ref: "#/$defs/dateTime" },
      },
    },
    provenance: {
      type: "object",
      additionalProperties: false,
      required: ["parserId", "parserVersion", "sourceLocation", "original"],
      properties: {
        parserId: { type: "string", minLength: 1, maxLength: 100 },
        parserVersion: { type: "string", minLength: 1, maxLength: 40 },
        sourceLocation: { type: "string", minLength: 1, maxLength: 160 },
        original: {
          type: "object",
          additionalProperties: { type: ["string", "number", "boolean", "null"] },
          maxProperties: 30,
        },
        transformations: {
          type: "array",
          maxItems: 30,
          items: { type: "string", minLength: 1, maxLength: 120 },
        },
      },
    },
  },
};
var schema134 = {
  type: "object",
  additionalProperties: false,
  required: ["parserId", "parserVersion", "sourceLocation", "original"],
  properties: {
    parserId: { type: "string", minLength: 1, maxLength: 100 },
    parserVersion: { type: "string", minLength: 1, maxLength: 40 },
    sourceLocation: { type: "string", minLength: 1, maxLength: 160 },
    original: {
      type: "object",
      additionalProperties: { type: ["string", "number", "boolean", "null"] },
      maxProperties: 30,
    },
    transformations: {
      type: "array",
      maxItems: 30,
      items: { type: "string", minLength: 1, maxLength: 120 },
    },
  },
};
var schema132 = {
  type: "object",
  additionalProperties: false,
  required: ["method", "classifierId", "classifierVersion", "evidence", "locked", "decidedAt"],
  properties: {
    method: {
      enum: ["user", "imported", "rule", "merchantMapping", "heuristic", "localAi", "remoteAi"],
    },
    classifierId: { type: "string", minLength: 1, maxLength: 100 },
    classifierVersion: { type: "string", minLength: 1, maxLength: 40 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidence: {
      type: "array",
      maxItems: 20,
      items: { type: "string", minLength: 1, maxLength: 160 },
    },
    locked: { type: "boolean" },
    decidedAt: { $ref: "#/$defs/dateTime" },
  },
};
function validate62(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate62.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.method === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "method" },
        message: "must have required property 'method'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.classifierId === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "classifierId" },
        message: "must have required property 'classifierId'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.classifierVersion === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "classifierVersion" },
        message: "must have required property 'classifierVersion'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.evidence === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "evidence" },
        message: "must have required property 'evidence'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.locked === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "locked" },
        message: "must have required property 'locked'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.decidedAt === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "decidedAt" },
        message: "must have required property 'decidedAt'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!(
        key0 === "method" ||
        key0 === "classifierId" ||
        key0 === "classifierVersion" ||
        key0 === "confidence" ||
        key0 === "evidence" ||
        key0 === "locked" ||
        key0 === "decidedAt"
      )) {
        const err6 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.method !== void 0) {
      let data0 = data.method;
      if (!(
        data0 === "user" ||
        data0 === "imported" ||
        data0 === "rule" ||
        data0 === "merchantMapping" ||
        data0 === "heuristic" ||
        data0 === "localAi" ||
        data0 === "remoteAi"
      )) {
        const err7 = {
          instancePath: instancePath + "/method",
          schemaPath: "#/properties/method/enum",
          keyword: "enum",
          params: { allowedValues: schema132.properties.method.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.classifierId !== void 0) {
      let data1 = data.classifierId;
      if (typeof data1 === "string") {
        if (func2(data1) > 100) {
          const err8 = {
            instancePath: instancePath + "/classifierId",
            schemaPath: "#/properties/classifierId/maxLength",
            keyword: "maxLength",
            params: { limit: 100 },
            message: "must NOT have more than 100 characters",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
        if (func2(data1) < 1) {
          const err9 = {
            instancePath: instancePath + "/classifierId",
            schemaPath: "#/properties/classifierId/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/classifierId",
          schemaPath: "#/properties/classifierId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.classifierVersion !== void 0) {
      let data2 = data.classifierVersion;
      if (typeof data2 === "string") {
        if (func2(data2) > 40) {
          const err11 = {
            instancePath: instancePath + "/classifierVersion",
            schemaPath: "#/properties/classifierVersion/maxLength",
            keyword: "maxLength",
            params: { limit: 40 },
            message: "must NOT have more than 40 characters",
          };
          if (vErrors === null) {
            vErrors = [err11];
          } else {
            vErrors.push(err11);
          }
          errors++;
        }
        if (func2(data2) < 1) {
          const err12 = {
            instancePath: instancePath + "/classifierVersion",
            schemaPath: "#/properties/classifierVersion/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err12];
          } else {
            vErrors.push(err12);
          }
          errors++;
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/classifierVersion",
          schemaPath: "#/properties/classifierVersion/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.confidence !== void 0) {
      let data3 = data.confidence;
      if (typeof data3 == "number" && isFinite(data3)) {
        if (data3 > 1 || isNaN(data3)) {
          const err14 = {
            instancePath: instancePath + "/confidence",
            schemaPath: "#/properties/confidence/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 1 },
            message: "must be <= 1",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data3 < 0 || isNaN(data3)) {
          const err15 = {
            instancePath: instancePath + "/confidence",
            schemaPath: "#/properties/confidence/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: 0 },
            message: "must be >= 0",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/confidence",
          schemaPath: "#/properties/confidence/type",
          keyword: "type",
          params: { type: "number" },
          message: "must be number",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.evidence !== void 0) {
      let data4 = data.evidence;
      if (Array.isArray(data4)) {
        if (data4.length > 20) {
          const err17 = {
            instancePath: instancePath + "/evidence",
            schemaPath: "#/properties/evidence/maxItems",
            keyword: "maxItems",
            params: { limit: 20 },
            message: "must NOT have more than 20 items",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
        const len0 = data4.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data5 = data4[i0];
          if (typeof data5 === "string") {
            if (func2(data5) > 160) {
              const err18 = {
                instancePath: instancePath + "/evidence/" + i0,
                schemaPath: "#/properties/evidence/items/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
            if (func2(data5) < 1) {
              const err19 = {
                instancePath: instancePath + "/evidence/" + i0,
                schemaPath: "#/properties/evidence/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err19];
              } else {
                vErrors.push(err19);
              }
              errors++;
            }
          } else {
            const err20 = {
              instancePath: instancePath + "/evidence/" + i0,
              schemaPath: "#/properties/evidence/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
      } else {
        const err21 = {
          instancePath: instancePath + "/evidence",
          schemaPath: "#/properties/evidence/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err21];
        } else {
          vErrors.push(err21);
        }
        errors++;
      }
    }
    if (data.locked !== void 0) {
      if (typeof data.locked !== "boolean") {
        const err22 = {
          instancePath: instancePath + "/locked",
          schemaPath: "#/properties/locked/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.decidedAt !== void 0) {
      let data7 = data.decidedAt;
      if (typeof data7 === "string") {
        if (!formats4.validate(data7)) {
          const err23 = {
            instancePath: instancePath + "/decidedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/decidedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
  } else {
    const err25 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err25];
    } else {
      vErrors.push(err25);
    }
    errors++;
  }
  validate62.errors = vErrors;
  return errors === 0;
}
validate62.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
function validate61(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate61.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = void 0;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = void 0;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    if (data.schemaVersion === void 0) {
      const err0 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "schemaVersion" },
        message: "must have required property 'schemaVersion'",
      };
      if (vErrors === null) {
        vErrors = [err0];
      } else {
        vErrors.push(err0);
      }
      errors++;
    }
    if (data.id === void 0) {
      const err1 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "id" },
        message: "must have required property 'id'",
      };
      if (vErrors === null) {
        vErrors = [err1];
      } else {
        vErrors.push(err1);
      }
      errors++;
    }
    if (data.accountId === void 0) {
      const err2 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "accountId" },
        message: "must have required property 'accountId'",
      };
      if (vErrors === null) {
        vErrors = [err2];
      } else {
        vErrors.push(err2);
      }
      errors++;
    }
    if (data.importId === void 0) {
      const err3 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "importId" },
        message: "must have required property 'importId'",
      };
      if (vErrors === null) {
        vErrors = [err3];
      } else {
        vErrors.push(err3);
      }
      errors++;
    }
    if (data.postedDate === void 0) {
      const err4 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "postedDate" },
        message: "must have required property 'postedDate'",
      };
      if (vErrors === null) {
        vErrors = [err4];
      } else {
        vErrors.push(err4);
      }
      errors++;
    }
    if (data.amount === void 0) {
      const err5 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "amount" },
        message: "must have required property 'amount'",
      };
      if (vErrors === null) {
        vErrors = [err5];
      } else {
        vErrors.push(err5);
      }
      errors++;
    }
    if (data.currency === void 0) {
      const err6 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "currency" },
        message: "must have required property 'currency'",
      };
      if (vErrors === null) {
        vErrors = [err6];
      } else {
        vErrors.push(err6);
      }
      errors++;
    }
    if (data.description === void 0) {
      const err7 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "description" },
        message: "must have required property 'description'",
      };
      if (vErrors === null) {
        vErrors = [err7];
      } else {
        vErrors.push(err7);
      }
      errors++;
    }
    if (data.status === void 0) {
      const err8 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "status" },
        message: "must have required property 'status'",
      };
      if (vErrors === null) {
        vErrors = [err8];
      } else {
        vErrors.push(err8);
      }
      errors++;
    }
    if (data.reviewState === void 0) {
      const err9 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "reviewState" },
        message: "must have required property 'reviewState'",
      };
      if (vErrors === null) {
        vErrors = [err9];
      } else {
        vErrors.push(err9);
      }
      errors++;
    }
    if (data.tags === void 0) {
      const err10 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "tags" },
        message: "must have required property 'tags'",
      };
      if (vErrors === null) {
        vErrors = [err10];
      } else {
        vErrors.push(err10);
      }
      errors++;
    }
    if (data.provenance === void 0) {
      const err11 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "provenance" },
        message: "must have required property 'provenance'",
      };
      if (vErrors === null) {
        vErrors = [err11];
      } else {
        vErrors.push(err11);
      }
      errors++;
    }
    if (data.classifications === void 0) {
      const err12 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "classifications" },
        message: "must have required property 'classifications'",
      };
      if (vErrors === null) {
        vErrors = [err12];
      } else {
        vErrors.push(err12);
      }
      errors++;
    }
    if (data.createdAt === void 0) {
      const err13 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "createdAt" },
        message: "must have required property 'createdAt'",
      };
      if (vErrors === null) {
        vErrors = [err13];
      } else {
        vErrors.push(err13);
      }
      errors++;
    }
    if (data.updatedAt === void 0) {
      const err14 = {
        instancePath,
        schemaPath: "#/required",
        keyword: "required",
        params: { missingProperty: "updatedAt" },
        message: "must have required property 'updatedAt'",
      };
      if (vErrors === null) {
        vErrors = [err14];
      } else {
        vErrors.push(err14);
      }
      errors++;
    }
    for (const key0 in data) {
      if (!func1.call(schema121.properties, key0)) {
        const err15 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err15];
        } else {
          vErrors.push(err15);
        }
        errors++;
      }
    }
    if (data.schemaVersion !== void 0) {
      if ("1.0.0" !== data.schemaVersion) {
        const err16 = {
          instancePath: instancePath + "/schemaVersion",
          schemaPath: "#/properties/schemaVersion/const",
          keyword: "const",
          params: { allowedValue: "1.0.0" },
          message: "must be equal to constant",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.id !== void 0) {
      let data1 = data.id;
      if (typeof data1 === "string") {
        if (!formats0.test(data1)) {
          const err17 = {
            instancePath: instancePath + "/id",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.accountId !== void 0) {
      let data2 = data.accountId;
      if (typeof data2 === "string") {
        if (!formats0.test(data2)) {
          const err19 = {
            instancePath: instancePath + "/accountId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      } else {
        const err20 = {
          instancePath: instancePath + "/accountId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err20];
        } else {
          vErrors.push(err20);
        }
        errors++;
      }
    }
    if (data.importId !== void 0) {
      let data3 = data.importId;
      if (typeof data3 === "string") {
        if (!formats0.test(data3)) {
          const err21 = {
            instancePath: instancePath + "/importId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      } else {
        const err22 = {
          instancePath: instancePath + "/importId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err22];
        } else {
          vErrors.push(err22);
        }
        errors++;
      }
    }
    if (data.postedDate !== void 0) {
      let data4 = data.postedDate;
      if (typeof data4 === "string") {
        if (!formats12.validate(data4)) {
          const err23 = {
            instancePath: instancePath + "/postedDate",
            schemaPath: "#/$defs/date/format",
            keyword: "format",
            params: { format: "date" },
            message: 'must match format "date"',
          };
          if (vErrors === null) {
            vErrors = [err23];
          } else {
            vErrors.push(err23);
          }
          errors++;
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/postedDate",
          schemaPath: "#/$defs/date/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.transactionDate !== void 0) {
      let data5 = data.transactionDate;
      if (typeof data5 === "string") {
        if (!formats12.validate(data5)) {
          const err25 = {
            instancePath: instancePath + "/transactionDate",
            schemaPath: "#/$defs/date/format",
            keyword: "format",
            params: { format: "date" },
            message: 'must match format "date"',
          };
          if (vErrors === null) {
            vErrors = [err25];
          } else {
            vErrors.push(err25);
          }
          errors++;
        }
      } else {
        const err26 = {
          instancePath: instancePath + "/transactionDate",
          schemaPath: "#/$defs/date/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err26];
        } else {
          vErrors.push(err26);
        }
        errors++;
      }
    }
    if (data.amount !== void 0) {
      let data6 = data.amount;
      if (typeof data6 === "string") {
        if (!pattern10.test(data6)) {
          const err27 = {
            instancePath: instancePath + "/amount",
            schemaPath: "#/$defs/decimal/pattern",
            keyword: "pattern",
            params: { pattern: "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$" },
            message: 'must match pattern "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$"',
          };
          if (vErrors === null) {
            vErrors = [err27];
          } else {
            vErrors.push(err27);
          }
          errors++;
        }
      } else {
        const err28 = {
          instancePath: instancePath + "/amount",
          schemaPath: "#/$defs/decimal/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    if (data.currency !== void 0) {
      let data7 = data.currency;
      if (typeof data7 === "string") {
        if (!pattern7.test(data7)) {
          const err29 = {
            instancePath: instancePath + "/currency",
            schemaPath: "#/$defs/currency/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Z]{3}$" },
            message: 'must match pattern "^[A-Z]{3}$"',
          };
          if (vErrors === null) {
            vErrors = [err29];
          } else {
            vErrors.push(err29);
          }
          errors++;
        }
      } else {
        const err30 = {
          instancePath: instancePath + "/currency",
          schemaPath: "#/$defs/currency/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err30];
        } else {
          vErrors.push(err30);
        }
        errors++;
      }
    }
    if (data.description !== void 0) {
      let data8 = data.description;
      if (typeof data8 === "string") {
        if (func2(data8) > 1e3) {
          const err31 = {
            instancePath: instancePath + "/description",
            schemaPath: "#/properties/description/maxLength",
            keyword: "maxLength",
            params: { limit: 1e3 },
            message: "must NOT have more than 1000 characters",
          };
          if (vErrors === null) {
            vErrors = [err31];
          } else {
            vErrors.push(err31);
          }
          errors++;
        }
        if (func2(data8) < 1) {
          const err32 = {
            instancePath: instancePath + "/description",
            schemaPath: "#/properties/description/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
      } else {
        const err33 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err33];
        } else {
          vErrors.push(err33);
        }
        errors++;
      }
    }
    if (data.sourceTransactionId !== void 0) {
      let data9 = data.sourceTransactionId;
      if (typeof data9 === "string") {
        if (func2(data9) > 240) {
          const err34 = {
            instancePath: instancePath + "/sourceTransactionId",
            schemaPath: "#/properties/sourceTransactionId/maxLength",
            keyword: "maxLength",
            params: { limit: 240 },
            message: "must NOT have more than 240 characters",
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
        if (func2(data9) < 1) {
          const err35 = {
            instancePath: instancePath + "/sourceTransactionId",
            schemaPath: "#/properties/sourceTransactionId/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/sourceTransactionId",
          schemaPath: "#/properties/sourceTransactionId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.merchantId !== void 0) {
      let data10 = data.merchantId;
      if (typeof data10 === "string") {
        if (!formats0.test(data10)) {
          const err37 = {
            instancePath: instancePath + "/merchantId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err37];
          } else {
            vErrors.push(err37);
          }
          errors++;
        }
      } else {
        const err38 = {
          instancePath: instancePath + "/merchantId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err38];
        } else {
          vErrors.push(err38);
        }
        errors++;
      }
    }
    if (data.categoryId !== void 0) {
      let data11 = data.categoryId;
      if (typeof data11 === "string") {
        if (!formats0.test(data11)) {
          const err39 = {
            instancePath: instancePath + "/categoryId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err39];
          } else {
            vErrors.push(err39);
          }
          errors++;
        }
      } else {
        const err40 = {
          instancePath: instancePath + "/categoryId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err40];
        } else {
          vErrors.push(err40);
        }
        errors++;
      }
    }
    if (data.tags !== void 0) {
      let data12 = data.tags;
      if (Array.isArray(data12)) {
        if (data12.length > 50) {
          const err41 = {
            instancePath: instancePath + "/tags",
            schemaPath: "#/properties/tags/maxItems",
            keyword: "maxItems",
            params: { limit: 50 },
            message: "must NOT have more than 50 items",
          };
          if (vErrors === null) {
            vErrors = [err41];
          } else {
            vErrors.push(err41);
          }
          errors++;
        }
        const len0 = data12.length;
        for (let i0 = 0; i0 < len0; i0++) {
          let data13 = data12[i0];
          if (typeof data13 === "string") {
            if (func2(data13) > 60) {
              const err42 = {
                instancePath: instancePath + "/tags/" + i0,
                schemaPath: "#/properties/tags/items/maxLength",
                keyword: "maxLength",
                params: { limit: 60 },
                message: "must NOT have more than 60 characters",
              };
              if (vErrors === null) {
                vErrors = [err42];
              } else {
                vErrors.push(err42);
              }
              errors++;
            }
            if (func2(data13) < 1) {
              const err43 = {
                instancePath: instancePath + "/tags/" + i0,
                schemaPath: "#/properties/tags/items/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err43];
              } else {
                vErrors.push(err43);
              }
              errors++;
            }
          } else {
            const err44 = {
              instancePath: instancePath + "/tags/" + i0,
              schemaPath: "#/properties/tags/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err44];
            } else {
              vErrors.push(err44);
            }
            errors++;
          }
        }
        let i1 = data12.length;
        let j0;
        if (i1 > 1) {
          const indices0 = {};
          for (; i1--;) {
            let item0 = data12[i1];
            if (typeof item0 !== "string") {
              continue;
            }
            if (typeof indices0[item0] == "number") {
              j0 = indices0[item0];
              const err45 = {
                instancePath: instancePath + "/tags",
                schemaPath: "#/properties/tags/uniqueItems",
                keyword: "uniqueItems",
                params: { i: i1, j: j0 },
                message:
                  "must NOT have duplicate items (items ## " +
                  j0 +
                  " and " +
                  i1 +
                  " are identical)",
              };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
              break;
            }
            indices0[item0] = i1;
          }
        }
      } else {
        const err46 = {
          instancePath: instancePath + "/tags",
          schemaPath: "#/properties/tags/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
    }
    if (data.notes !== void 0) {
      let data14 = data.notes;
      if (typeof data14 === "string") {
        if (func2(data14) > 2e3) {
          const err47 = {
            instancePath: instancePath + "/notes",
            schemaPath: "#/properties/notes/maxLength",
            keyword: "maxLength",
            params: { limit: 2e3 },
            message: "must NOT have more than 2000 characters",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
      } else {
        const err48 = {
          instancePath: instancePath + "/notes",
          schemaPath: "#/properties/notes/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err48];
        } else {
          vErrors.push(err48);
        }
        errors++;
      }
    }
    if (data.status !== void 0) {
      let data15 = data.status;
      if (!(data15 === "pending" || data15 === "posted" || data15 === "void")) {
        const err49 = {
          instancePath: instancePath + "/status",
          schemaPath: "#/properties/status/enum",
          keyword: "enum",
          params: { allowedValues: schema121.properties.status.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err49];
        } else {
          vErrors.push(err49);
        }
        errors++;
      }
    }
    if (data.reviewState !== void 0) {
      let data16 = data.reviewState;
      if (!(data16 === "unreviewed" || data16 === "needsReview" || data16 === "reviewed")) {
        const err50 = {
          instancePath: instancePath + "/reviewState",
          schemaPath: "#/properties/reviewState/enum",
          keyword: "enum",
          params: { allowedValues: schema121.properties.reviewState.enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err50];
        } else {
          vErrors.push(err50);
        }
        errors++;
      }
    }
    if (data.transferLinkId !== void 0) {
      let data17 = data.transferLinkId;
      if (typeof data17 === "string") {
        if (!formats0.test(data17)) {
          const err51 = {
            instancePath: instancePath + "/transferLinkId",
            schemaPath: "#/$defs/uuid/format",
            keyword: "format",
            params: { format: "uuid" },
            message: 'must match format "uuid"',
          };
          if (vErrors === null) {
            vErrors = [err51];
          } else {
            vErrors.push(err51);
          }
          errors++;
        }
      } else {
        const err52 = {
          instancePath: instancePath + "/transferLinkId",
          schemaPath: "#/$defs/uuid/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err52];
        } else {
          vErrors.push(err52);
        }
        errors++;
      }
    }
    if (data.classifications !== void 0) {
      let data18 = data.classifications;
      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
        for (const key1 in data18) {
          if (!(key1 === "merchant" || key1 === "category")) {
            const err53 = {
              instancePath: instancePath + "/classifications",
              schemaPath: "#/properties/classifications/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err53];
            } else {
              vErrors.push(err53);
            }
            errors++;
          }
        }
        if (data18.merchant !== void 0) {
          if (
            !validate62(data18.merchant, {
              instancePath: instancePath + "/classifications/merchant",
              parentData: data18,
              parentDataProperty: "merchant",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate62.errors : vErrors.concat(validate62.errors);
            errors = vErrors.length;
          }
        }
        if (data18.category !== void 0) {
          if (
            !validate62(data18.category, {
              instancePath: instancePath + "/classifications/category",
              parentData: data18,
              parentDataProperty: "category",
              rootData,
              dynamicAnchors,
            })
          ) {
            vErrors = vErrors === null ? validate62.errors : vErrors.concat(validate62.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err54 = {
          instancePath: instancePath + "/classifications",
          schemaPath: "#/properties/classifications/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err54];
        } else {
          vErrors.push(err54);
        }
        errors++;
      }
    }
    if (data.provenance !== void 0) {
      let data21 = data.provenance;
      if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
        if (data21.parserId === void 0) {
          const err55 = {
            instancePath: instancePath + "/provenance",
            schemaPath: "#/$defs/provenance/required",
            keyword: "required",
            params: { missingProperty: "parserId" },
            message: "must have required property 'parserId'",
          };
          if (vErrors === null) {
            vErrors = [err55];
          } else {
            vErrors.push(err55);
          }
          errors++;
        }
        if (data21.parserVersion === void 0) {
          const err56 = {
            instancePath: instancePath + "/provenance",
            schemaPath: "#/$defs/provenance/required",
            keyword: "required",
            params: { missingProperty: "parserVersion" },
            message: "must have required property 'parserVersion'",
          };
          if (vErrors === null) {
            vErrors = [err56];
          } else {
            vErrors.push(err56);
          }
          errors++;
        }
        if (data21.sourceLocation === void 0) {
          const err57 = {
            instancePath: instancePath + "/provenance",
            schemaPath: "#/$defs/provenance/required",
            keyword: "required",
            params: { missingProperty: "sourceLocation" },
            message: "must have required property 'sourceLocation'",
          };
          if (vErrors === null) {
            vErrors = [err57];
          } else {
            vErrors.push(err57);
          }
          errors++;
        }
        if (data21.original === void 0) {
          const err58 = {
            instancePath: instancePath + "/provenance",
            schemaPath: "#/$defs/provenance/required",
            keyword: "required",
            params: { missingProperty: "original" },
            message: "must have required property 'original'",
          };
          if (vErrors === null) {
            vErrors = [err58];
          } else {
            vErrors.push(err58);
          }
          errors++;
        }
        for (const key2 in data21) {
          if (!(
            key2 === "parserId" ||
            key2 === "parserVersion" ||
            key2 === "sourceLocation" ||
            key2 === "original" ||
            key2 === "transformations"
          )) {
            const err59 = {
              instancePath: instancePath + "/provenance",
              schemaPath: "#/$defs/provenance/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err59];
            } else {
              vErrors.push(err59);
            }
            errors++;
          }
        }
        if (data21.parserId !== void 0) {
          let data22 = data21.parserId;
          if (typeof data22 === "string") {
            if (func2(data22) > 100) {
              const err60 = {
                instancePath: instancePath + "/provenance/parserId",
                schemaPath: "#/$defs/provenance/properties/parserId/maxLength",
                keyword: "maxLength",
                params: { limit: 100 },
                message: "must NOT have more than 100 characters",
              };
              if (vErrors === null) {
                vErrors = [err60];
              } else {
                vErrors.push(err60);
              }
              errors++;
            }
            if (func2(data22) < 1) {
              const err61 = {
                instancePath: instancePath + "/provenance/parserId",
                schemaPath: "#/$defs/provenance/properties/parserId/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err61];
              } else {
                vErrors.push(err61);
              }
              errors++;
            }
          } else {
            const err62 = {
              instancePath: instancePath + "/provenance/parserId",
              schemaPath: "#/$defs/provenance/properties/parserId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err62];
            } else {
              vErrors.push(err62);
            }
            errors++;
          }
        }
        if (data21.parserVersion !== void 0) {
          let data23 = data21.parserVersion;
          if (typeof data23 === "string") {
            if (func2(data23) > 40) {
              const err63 = {
                instancePath: instancePath + "/provenance/parserVersion",
                schemaPath: "#/$defs/provenance/properties/parserVersion/maxLength",
                keyword: "maxLength",
                params: { limit: 40 },
                message: "must NOT have more than 40 characters",
              };
              if (vErrors === null) {
                vErrors = [err63];
              } else {
                vErrors.push(err63);
              }
              errors++;
            }
            if (func2(data23) < 1) {
              const err64 = {
                instancePath: instancePath + "/provenance/parserVersion",
                schemaPath: "#/$defs/provenance/properties/parserVersion/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
          } else {
            const err65 = {
              instancePath: instancePath + "/provenance/parserVersion",
              schemaPath: "#/$defs/provenance/properties/parserVersion/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err65];
            } else {
              vErrors.push(err65);
            }
            errors++;
          }
        }
        if (data21.sourceLocation !== void 0) {
          let data24 = data21.sourceLocation;
          if (typeof data24 === "string") {
            if (func2(data24) > 160) {
              const err66 = {
                instancePath: instancePath + "/provenance/sourceLocation",
                schemaPath: "#/$defs/provenance/properties/sourceLocation/maxLength",
                keyword: "maxLength",
                params: { limit: 160 },
                message: "must NOT have more than 160 characters",
              };
              if (vErrors === null) {
                vErrors = [err66];
              } else {
                vErrors.push(err66);
              }
              errors++;
            }
            if (func2(data24) < 1) {
              const err67 = {
                instancePath: instancePath + "/provenance/sourceLocation",
                schemaPath: "#/$defs/provenance/properties/sourceLocation/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              if (vErrors === null) {
                vErrors = [err67];
              } else {
                vErrors.push(err67);
              }
              errors++;
            }
          } else {
            const err68 = {
              instancePath: instancePath + "/provenance/sourceLocation",
              schemaPath: "#/$defs/provenance/properties/sourceLocation/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err68];
            } else {
              vErrors.push(err68);
            }
            errors++;
          }
        }
        if (data21.original !== void 0) {
          let data25 = data21.original;
          if (data25 && typeof data25 == "object" && !Array.isArray(data25)) {
            if (Object.keys(data25).length > 30) {
              const err69 = {
                instancePath: instancePath + "/provenance/original",
                schemaPath: "#/$defs/provenance/properties/original/maxProperties",
                keyword: "maxProperties",
                params: { limit: 30 },
                message: "must NOT have more than 30 properties",
              };
              if (vErrors === null) {
                vErrors = [err69];
              } else {
                vErrors.push(err69);
              }
              errors++;
            }
            for (const key3 in data25) {
              let data26 = data25[key3];
              if (
                typeof data26 !== "string" &&
                !(typeof data26 == "number" && isFinite(data26)) &&
                typeof data26 !== "boolean" &&
                data26 !== null
              ) {
                const err70 = {
                  instancePath:
                    instancePath +
                    "/provenance/original/" +
                    key3.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath: "#/$defs/provenance/properties/original/additionalProperties/type",
                  keyword: "type",
                  params: { type: schema134.properties.original.additionalProperties.type },
                  message: "must be string,number,boolean,null",
                };
                if (vErrors === null) {
                  vErrors = [err70];
                } else {
                  vErrors.push(err70);
                }
                errors++;
              }
            }
          } else {
            const err71 = {
              instancePath: instancePath + "/provenance/original",
              schemaPath: "#/$defs/provenance/properties/original/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err71];
            } else {
              vErrors.push(err71);
            }
            errors++;
          }
        }
        if (data21.transformations !== void 0) {
          let data27 = data21.transformations;
          if (Array.isArray(data27)) {
            if (data27.length > 30) {
              const err72 = {
                instancePath: instancePath + "/provenance/transformations",
                schemaPath: "#/$defs/provenance/properties/transformations/maxItems",
                keyword: "maxItems",
                params: { limit: 30 },
                message: "must NOT have more than 30 items",
              };
              if (vErrors === null) {
                vErrors = [err72];
              } else {
                vErrors.push(err72);
              }
              errors++;
            }
            const len1 = data27.length;
            for (let i2 = 0; i2 < len1; i2++) {
              let data28 = data27[i2];
              if (typeof data28 === "string") {
                if (func2(data28) > 120) {
                  const err73 = {
                    instancePath: instancePath + "/provenance/transformations/" + i2,
                    schemaPath: "#/$defs/provenance/properties/transformations/items/maxLength",
                    keyword: "maxLength",
                    params: { limit: 120 },
                    message: "must NOT have more than 120 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err73];
                  } else {
                    vErrors.push(err73);
                  }
                  errors++;
                }
                if (func2(data28) < 1) {
                  const err74 = {
                    instancePath: instancePath + "/provenance/transformations/" + i2,
                    schemaPath: "#/$defs/provenance/properties/transformations/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  if (vErrors === null) {
                    vErrors = [err74];
                  } else {
                    vErrors.push(err74);
                  }
                  errors++;
                }
              } else {
                const err75 = {
                  instancePath: instancePath + "/provenance/transformations/" + i2,
                  schemaPath: "#/$defs/provenance/properties/transformations/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err75];
                } else {
                  vErrors.push(err75);
                }
                errors++;
              }
            }
          } else {
            const err76 = {
              instancePath: instancePath + "/provenance/transformations",
              schemaPath: "#/$defs/provenance/properties/transformations/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            if (vErrors === null) {
              vErrors = [err76];
            } else {
              vErrors.push(err76);
            }
            errors++;
          }
        }
      } else {
        const err77 = {
          instancePath: instancePath + "/provenance",
          schemaPath: "#/$defs/provenance/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err77];
        } else {
          vErrors.push(err77);
        }
        errors++;
      }
    }
    if (data.createdAt !== void 0) {
      let data29 = data.createdAt;
      if (typeof data29 === "string") {
        if (!formats4.validate(data29)) {
          const err78 = {
            instancePath: instancePath + "/createdAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err78];
          } else {
            vErrors.push(err78);
          }
          errors++;
        }
      } else {
        const err79 = {
          instancePath: instancePath + "/createdAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err79];
        } else {
          vErrors.push(err79);
        }
        errors++;
      }
    }
    if (data.updatedAt !== void 0) {
      let data30 = data.updatedAt;
      if (typeof data30 === "string") {
        if (!formats4.validate(data30)) {
          const err80 = {
            instancePath: instancePath + "/updatedAt",
            schemaPath: "#/$defs/dateTime/format",
            keyword: "format",
            params: { format: "date-time" },
            message: 'must match format "date-time"',
          };
          if (vErrors === null) {
            vErrors = [err80];
          } else {
            vErrors.push(err80);
          }
          errors++;
        }
      } else {
        const err81 = {
          instancePath: instancePath + "/updatedAt",
          schemaPath: "#/$defs/dateTime/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err81];
        } else {
          vErrors.push(err81);
        }
        errors++;
      }
    }
  } else {
    const err82 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err82];
    } else {
      vErrors.push(err82);
    }
    errors++;
  }
  validate61.errors = vErrors;
  return errors === 0;
}
validate61.evaluated = { props: true, dynamicProps: false, dynamicItems: false };
export {
  validateAiProviderSchema,
  validateAiTaskSchema,
  validateCategorySchema,
  validateDashboardSchema,
  validateFinancialBrainSchema,
  validateImportSchema,
  validateMerchantSchema,
  validateTransactionSchema,
};
