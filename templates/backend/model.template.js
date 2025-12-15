/**
 * Mongoose Model Template
 *
 * Variables:
 *   {{modelName}} - Model class name
 *   {{collectionName}} - MongoDB collection name
 *   {{#fields}} {{name}}: {{type}} {{/fields}} - Model fields
 *   {{#indexes}} {{fields}} {{options}} {{/indexes}} - Database indexes
 *   {{#methods}} {{name}} {{/methods}} - Instance methods
 *   {{#statics}} {{name}} {{/statics}} - Static methods
 *
 * This template can be customized by editing it directly.
 */

const mongoose = require('mongoose');
{{#imports}}
const {{name}} = require('{{path}}');
{{/imports}}

const {{schemaName}} = new mongoose.Schema(
  {
    {{#fields}}
    {{name}}: {
      type: {{mongooseType}},
      {{#required}}required: [true, '{{name}} is required'],{{/required}}
      {{#unique}}unique: true,{{/unique}}
      {{#default}}default: {{default}},{{/default}}
      {{#enum}}enum: [{{#values}}'{{.}}'{{^last}}, {{/last}}{{/values}}],{{/enum}}
      {{#ref}}ref: '{{ref}}',{{/ref}}
      {{#select}}select: {{select}},{{/select}}
      {{#index}}index: true,{{/index}}
      {{#minLength}}minLength: [{{minLength}}, '{{name}} must be at least {{minLength}} characters'],{{/minLength}}
      {{#maxLength}}maxLength: [{{maxLength}}, '{{name}} must be at most {{maxLength}} characters'],{{/maxLength}}
      {{#min}}min: [{{min}}, '{{name}} must be at least {{min}}'],{{/min}}
      {{#max}}max: [{{max}}, '{{name}} must be at most {{max}}'],{{/max}}
      {{#match}}match: [{{match}}, '{{name}} format is invalid'],{{/match}}
      {{#trim}}trim: true,{{/trim}}
      {{#lowercase}}lowercase: true,{{/lowercase}}
    },
    {{/fields}}
  },
  {
    timestamps: true,
    {{#versionKey}}versionKey: '{{versionKey}}',{{/versionKey}}
    {{#collection}}collection: '{{collection}}',{{/collection}}
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
{{#indexes}}
{{schemaName}}.index({{fields}}, {{options}});
{{/indexes}}

// Virtual fields
{{#virtuals}}
{{schemaName}}.virtual('{{name}}').get(function () {
  {{getter}}
});
{{/virtuals}}

// Pre-save middleware
{{schemaName}}.pre('save', async function (next) {
  {{#preSave}}
  {{.}}
  {{/preSave}}
  next();
});

// Instance methods
{{#methods}}
{{schemaName}}.methods.{{name}} = {{#async}}async {{/async}}function({{params}}) {
  {{body}}
};

{{/methods}}

// Static methods
{{#statics}}
{{schemaName}}.statics.{{name}} = {{#async}}async {{/async}}function({{params}}) {
  {{body}}
};

{{/statics}}

const {{modelName}} = mongoose.model('{{modelName}}', {{schemaName}});

module.exports = {{modelName}};
