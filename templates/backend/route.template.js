/**
 * Express Route Template
 *
 * Variables:
 *   {{routeName}} - Route resource name
 *   {{basePath}} - Base URL path
 *   {{routeType}} - crud | custom | resource
 *   {{controller}} - Controller name
 *   {{#middleware}} {{.}} {{/middleware}} - Middleware to apply
 *   {{#endpoints}} {{method}} {{path}} {{handler}} {{/endpoints}} - Custom endpoints
 *
 * This template can be customized by editing it directly.
 */

const express = require('express');
const router = express.Router();
{{#imports}}
const {{name}} = require('{{path}}');
{{/imports}}
const {{controller}} = require('../controllers/{{controllerFile}}');
{{#middleware}}
const {{.}} = require('../middleware/{{.}}.middleware');
{{/middleware}}

/**
 * @route   GET {{basePath}}
 * @desc    Get all {{routeName}}
 * @access  {{access}}
 */
router.get('/',
  {{#listMiddleware}}{{.}}, {{/listMiddleware}}
  {{controller}}.list
);

/**
 * @route   GET {{basePath}}/:id
 * @desc    Get {{routeName}} by ID
 * @access  {{access}}
 */
router.get('/:id',
  {{#getMiddleware}}{{.}}, {{/getMiddleware}}
  {{controller}}.getById
);

/**
 * @route   POST {{basePath}}
 * @desc    Create new {{routeName}}
 * @access  {{access}}
 */
router.post('/',
  {{#createMiddleware}}{{.}}, {{/createMiddleware}}
  {{controller}}.create
);

/**
 * @route   PUT {{basePath}}/:id
 * @desc    Update {{routeName}} by ID
 * @access  {{access}}
 */
router.put('/:id',
  {{#updateMiddleware}}{{.}}, {{/updateMiddleware}}
  {{controller}}.update
);

/**
 * @route   DELETE {{basePath}}/:id
 * @desc    Delete {{routeName}} by ID
 * @access  {{access}}
 */
router.delete('/:id',
  {{#deleteMiddleware}}{{.}}, {{/deleteMiddleware}}
  {{controller}}.delete
);

{{#customEndpoints}}
/**
 * @route   {{method}} {{basePath}}{{path}}
 * @desc    {{description}}
 * @access  {{access}}
 */
router.{{methodLower}}('{{path}}',
  {{#middleware}}{{.}}, {{/middleware}}
  {{controller}}.{{handler}}
);

{{/customEndpoints}}

module.exports = router;
