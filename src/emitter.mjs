import * as util from "./util/index.mjs";
import * as is from "./is.mjs";
import Event from "./event.mjs";

const eventRegex = /^([^.]+)(\.(?:[^.]+))?$/; // regex for matching event strings (e.g. "click.namespace")
const universalNamespace = ".*"; // matches as if no namespace specified and prevents users from unbinding accidentally

const defaults = {
  qualifierCompare: function (q1, q2) {
    return q1 === q2;
  },
  eventMatches: function (/*context, listener, eventObj*/) {
    return true;
  },
  addEventFields: function (/*context, evt*/) {},
  callbackContext: function (context /*, listener, eventObj*/) {
    return context;
  },
  beforeEmit: function (/* context, listener, eventObj */) {},
  afterEmit: function (/* context, listener, eventObj */) {},
  bubble: function (/*context*/) {
    return false;
  },
  parent: function (/*context*/) {
    return null;
  },
  context: null,
};

const defaultsKeys = Object.keys(defaults);
const emptyOpts = {};

function Emitter(opts = emptyOpts, context) {
  // micro-optimisation vs Object.assign() -- reduces Element instantiation time
  for (let i = 0; i < defaultsKeys.length; i++) {
    const key = defaultsKeys[i];

    this[key] = opts[key] || defaults[key];
  }

  this.context = context || this.context;
  this.listeners = [];
  this.emitting = 0;
}

const p = Emitter.prototype;

const forEachEvent = function (
  self,
  handler,
  events,
  qualifier,
  callback,
  conf,
  confOverrides,
) {
  if (is.fn(qualifier)) {
    callback = qualifier;
    qualifier = null;
  }

  if (confOverrides) {
    if (conf == null) {
      conf = confOverrides;
    } else {
      conf = util.assign({}, conf, confOverrides);
    }
  }

  const eventList = is.array(events) ? events : events.split(/\s+/);

  for (let i = 0; i < eventList.length; i++) {
    const evt = eventList[i];

    if (is.emptyString(evt)) {
      continue;
    }

    const match = evt.match(eventRegex); // type[.namespace]

    if (match) {
      const type = match[1];
      const namespace = match[2] ? match[2] : null;
      const ret = handler(
        self,
        evt,
        type,
        namespace,
        qualifier,
        callback,
        conf,
      );

      if (ret === false) {
        break;
      } // allow exiting early
    }
  }
};

const makeEventObj = function (self, obj) {
  self.addEventFields(self.context, obj);

  return new Event(obj.type, obj);
};

const forEachEventObj = function (self, handler, events) {
  if (is.event(events)) {
    handler(self, events);

    return;
  } else if (is.plainObject(events)) {
    handler(self, makeEventObj(self, events));

    return;
  }

  const eventList = is.array(events) ? events : events.split(/\s+/);

  for (let i = 0; i < eventList.length; i++) {
    const evt = eventList[i];

    if (is.emptyString(evt)) {
      continue;
    }

    const match = evt.match(eventRegex); // type[.namespace]

    if (match) {
      const type = match[1];
      const namespace = match[2] ? match[2] : null;
      const eventObj = makeEventObj(self, {
        type: type,
        namespace: namespace,
        target: self.context,
      });

      handler(self, eventObj);
    }
  }
};

p.on = p.addListener = function (
  events,
  qualifier,
  callback,
  conf,
  confOverrides,
) {
  forEachEvent(
    this,
    function (self, event, type, namespace, qualifier, callback, conf) {
      if (is.fn(callback)) {
        self.listeners.push({
          event: event, // full event string
          callback: callback, // callback to run
          type: type, // the event type (e.g. 'click')
          namespace: namespace, // the event namespace (e.g. ".foo")
          qualifier: qualifier, // a restriction on whether to match this emitter
          conf: conf, // additional configuration
        });
      }
    },
    events,
    qualifier,
    callback,
    conf,
    confOverrides,
  );

  return this;
};

p.one = function (events, qualifier, callback, conf) {
  return this.on(events, qualifier, callback, conf, { one: true });
};

p.removeListener = p.off = function (events, qualifier, callback, conf) {
  if (this.emitting !== 0) {
    this.listeners = util.copyArray(this.listeners);
  }

  const listeners = this.listeners;

  for (let i = listeners.length - 1; i >= 0; i--) {
    const listener = listeners[i];

    forEachEvent(
      this,
      function (self, event, type, namespace, qualifier, callback /*, conf*/) {
        if (
          (listener.type === type || events === "*") &&
          ((!namespace && listener.namespace !== ".*") ||
            listener.namespace === namespace) &&
          (!qualifier ||
            self.qualifierCompare(listener.qualifier, qualifier)) &&
          (!callback || listener.callback === callback)
        ) {
          listeners.splice(i, 1);

          return false;
        }
      },
      events,
      qualifier,
      callback,
      conf,
    );
  }

  return this;
};

p.removeAllListeners = function () {
  return this.removeListener("*");
};

p.emit = p.trigger = function (events, extraParams, manualCallback) {
  const listeners = this.listeners;
  const numListenersBeforeEmit = listeners.length;

  this.emitting++;

  if (!is.array(extraParams)) {
    extraParams = [extraParams];
  }

  forEachEventObj(
    this,
    function (self, eventObj) {
      if (manualCallback != null) {
        listeners = [
          {
            event: eventObj.event,
            type: eventObj.type,
            namespace: eventObj.namespace,
            callback: manualCallback,
          },
        ];

        numListenersBeforeEmit = listeners.length;
      }

      for (let i = 0; i < numListenersBeforeEmit; i++) {
        const listener = listeners[i];

        if (
          listener.type === eventObj.type &&
          (!listener.namespace ||
            listener.namespace === eventObj.namespace ||
            listener.namespace === universalNamespace) &&
          self.eventMatches(self.context, listener, eventObj)
        ) {
          const args = [eventObj];

          if (extraParams != null) {
            util.push(args, extraParams);
          }

          self.beforeEmit(self.context, listener, eventObj);

          if (listener.conf && listener.conf.one) {
            self.listeners = self.listeners.filter((l) => l !== listener);
          }

          const context = self.callbackContext(
            self.context,
            listener,
            eventObj,
          );
          const ret = listener.callback.apply(context, args);

          self.afterEmit(self.context, listener, eventObj);

          if (ret === false) {
            eventObj.stopPropagation();
            eventObj.preventDefault();
          }
        } // if listener matches
      } // for listener

      if (self.bubble(self.context) && !eventObj.isPropagationStopped()) {
        self.parent(self.context).emit(eventObj, extraParams);
      }
    },
    events,
  );

  this.emitting--;

  return this;
};

export default Emitter;
