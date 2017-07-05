module.exports = {
  parser: 'babel-eslint',
  rules: {
    'linebreak-style': [2, 'unix'],
    semi: [0, 'always'],
    'react/jsx-uses-react': 1,
    'react/jsx-uses-vars': 1,
    'react/jsx-no-duplicate-props': 2,
    'react/jsx-no-target-blank': 2,

    // Turn off all the style rules
    'array-bracket-spacing': 0,
    'block-spacing': 0,
    'brace-style': 0,
    camelcase: 0,
    'capitalized-comments': 0,
    'comma-spacing': 0,
    'comma-style': 0,
    'computed-property-spacing': 0,
    'consistent-this': 0,
    'eol-last': 0,
    'func-call-spacing': 0,
    'func-name-matching': 0,
    'func-names': 0,
    'func-style': 0,
    'id-blacklist': 'off',
    'id-length': 'off',
    'id-match': 'off',
    indent: 0,
    'jsx-quotes': 0,
    'key-spacing': 0,
    'keyword-spacing': 0,
    'line-comment-position': 0,
    'linebreak-style': 0,
    'lines-around-comment': 'off',
    'lines-around-directive': 0,
    'max-depth': 0,
    'max-len': 0,
    'max-lines': 0,
    'max-nested-callbacks': 'off',
    'max-params': ['off', 3],
    'max-statements': ['off', 10],
    'max-statements-per-line': ['off', {max: 1}],
    'multiline-ternary': ['off', 'never'],
    'new-cap': 0,
    'new-parens': 0,
    'newline-after-var': 'off',
    'newline-before-return': 'off',
    'newline-per-chained-call': 0,
    'no-array-constructor': 0,
    'no-bitwise': 0,
    'no-continue': 0,
    'no-inline-comments': 'off',
    'no-lonely-if': 0,
    'no-mixed-operators': 0,
    'no-mixed-spaces-and-tabs': 0,
    'no-multi-assign': 0,
    'no-multiple-empty-lines': 0,
    'no-negated-condition': 'off',
    'no-nested-ternary': 'warn',
    'no-new-object': 'warn',
    'no-plusplus': 0,
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForInStatement',
        message:
          'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
      },
      {
        selector: 'ForOfStatement',
        message:
          'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.',
      },
      {
        selector: 'LabeledStatement',
        message:
          'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
      },
      {
        selector: 'WithStatement',
        message:
          '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
      },
      {
        selector: 'CallExpression[callee.name="xdescribe"]',
        message:
          '`xdescribe` is disallowed in the build. If this test suite really needs to be skipped, disable the `no-restricted-syntax` rule with a reason to ignore the test',
      },
      {
        selector: 'CallExpression[callee.name="xit"]',
        message:
          '`xit` is disallowed in the build. If this test really needs to be skipped, disable the `no-restricted-syntax` rule with a reason to ignore the test',
      },
      {
        selector: 'CallExpression[callee.name="fdescribe"]',
        message:
          'Focused specs are not allowed to be checked in because all the tests need to run in CI.',
      },
      {
        selector: 'CallExpression[callee.name="fit"]',
        message:
          'Focused specs are not allowed to be checked in because all the tests need to run in CI.',
      },
    ],
    'no-spaced-func': 0,
    'no-tabs': 0,
    'no-ternary': 'off',
    'no-trailing-spaces': 0,
    'no-underscore-dangle': 0,
    'no-unneeded-ternary': 0,
    'no-whitespace-before-property': 0,
    'nonblock-statement-body-position': 'off',
    'object-curly-spacing': 0,
    'object-curly-newline': 0,
    'object-property-newline': 0,
    'one-var': 0,
    'one-var-declaration-per-line': 0,
    'operator-assignment': 0,
    'operator-linebreak': 'off',
    'padded-blocks': 0,
    'quote-props': 0,
    quotes: 0,
    'require-jsdoc': 'off',
    semi: 0,
    'semi-spacing': 0,
    'sort-keys': 0,
    'sort-vars': 'off',
    'space-before-blocks': 0,
    'space-before-function-paren': 0,
    'space-in-parens': 0,
    'space-infix-ops': 0,
    'space-unary-ops': 0,
    'spaced-comment': 0,
    'template-tag-spacing': ['off', 'never'],
    'unicode-bom': 0,
    'wrap-regex': 'off',

    'wrap-iife': 0,
    'no-mixed-operators': 0,

    // Things that should be fixed
    'no-use-before-define': 0,
    'no-param-reassign': 1,
    'no-shadow': 1,
    'react/no-did-update-set-state': 1,
    'react/no-did-mount-set-state': 1,
    'react/no-string-refs': 1,
    'prefer-rest-params': 1,
    'react/no-array-index-key': 1,
    'no-return-assign': 1,

    // Styling that I like (for good reasons)
    quotes: [0, 'single', {avoidEscape: true}],
    'prefer-arrow-callback': 0, // I like this rule, but a lot of unit tests depend on `this`, ignore for now
    'arrow-body-style': [0, 'as-needed'],
    'import/prefer-default-export': 1,
    'dot-notation': 1,
    'prefer-template': 1,
    'space-infix-ops': 1,
    curly: [0, 'multi-line'],
    'one-var-declaration-per-line': 0,
    'one-var': 0,
    'react/jsx-first-prop-new-line': [0, 'multiline'],
    'react/jsx-closing-bracket-location': 0,
    'react/jsx-indent-props': [0, 2],
    'react/jsx-indent': [0, 2],
    'no-spaced-func': 0,
    'func-call-spacing': 0, // Dup
    'comma-dangle': [0, 'always-multiline'],

    // Styling that I like (for arbitrary reasons)
    'max-len': [
      0,
      120,
      {
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],
    'quote-props': [0, 'as-needed'],
    'object-shorthand': 1,
    'space-in-parens': [0, 'never'],
    'padded-blocks': [0, 'never'],
    'comma-spacing': 0,
    'no-multi-spaces': 0,
    'key-spacing': [0, {beforeColon: false, afterColon: true}],
    'object-property-newline': 0,
    'space-before-blocks': [0, 'always'],
    'react/jsx-wrap-multilines': 0,
    'arrow-spacing': 0,
    'spaced-comment': 1,
    'no-else-return': 1,
    'keyword-spacing': 0, //There's a bunch of options for this

    // Things that don't really work for our code base or I don't want to do
    'func-names': 0,
    'import/extensions': [0, 'always'],
    'import/first': 0,
    'import/no-extraneous-dependencies': 0, // Doesn't like our import structure
    'import/no-unresolved': 0, // Doesn't like our import structure
    'react/jsx-filename-extension': 0,
    'consistent-return': 0, // Flow knows what each method can return so we can handle all cases
    'react/require-default-props': 0,
    'no-underscore-dangle': 0,

    // Talk about
    'no-plusplus': 0, // Might be good to talk abourt: https://github.com/airbnb/javascript#variables--unary-increment-decrement
    'no-unused-expressions': 0, // Not quite sure what this does
    'no-continue': 0,
    'no-prototype-builtins': 0,
    'react/sort-comp': 0, // Neat idea, but needs some config
    'react/jsx-boolean-value': 0, // Worth discussing. Hadn't thought of that syntax
    'import/no-named-as-default': 0,
    'react/jsx-no-bind': 0,
    'class-methods-use-this': 0, // Tells you to make everything static that doesn't reference `this`

    // Accessibility
    'jsx-a11y/no-static-element-interactions': 0, // This probably needs to be addressed sometime
    'jsx-a11y/href-no-hash': 0,
    'jsx-a11y/label-has-for': 0,
    'jsx-a11y/img-has-alt': 0,

    // Rules to turn on if devs whine about consistency
    'template-curly-spacing': [0, 'never'],
    'array-bracket-spacing': [0, 'never'],
    'object-curly-spacing': [0, 'never'], // airbnb does always
    'react/jsx-space-before-closing': [0, 'always'], // Style, might be nice
    'react/jsx-tag-spacing': 0,
    'react/jsx-curly-spacing': [0, 'never'],
    'react/jsx-equals-spacing': [0, 'never'], // Style, I like it
    'jsx-quotes': [0, 'prefer-double'],
    'space-before-function-paren': [0, 'always'],
    'brace-style': [0, 'stroustrup'], // eslint uses 1tbs
    'arrow-parens': [0, 'as-needed'],
    'eol-last': 0,
    'default-case': 0,
    'block-spacing': 0,
    'no-lonely-if': 0, // Got tired of fixing these
  },
  extends: 'airbnb',

  env: {
    es6: true,
    browser: true,
    jasmine: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
      experimentalObjectRestSpread: true,
    },
  },
  plugins: ['react', 'flowtype'],
  globals: {
    jest: false,
    T: false,
    ReactComponent: false,
    ReactElement: false,
    React$Element: false,
    SyntheticEvent: false,
    SyntheticClipboardEvent: false,
    SyntheticCompositionEvent: false,
    SyntheticInputEvent: false,
    SyntheticUIEvent: false,
    SyntheticFocusEvent: false,
    SyntheticKeyboardEvent: false,
    SyntheticMouseEvent: false,
    SyntheticDragEvent: false,
    SyntheticWheelEvent: false,
    SyntheticTouchEvent: false,
    moment$Moment: false,
    ReactWrapper: false,
    ShallowWrapper: false,
    Wrapper: false,
    RequestOptions: false,
  },
};
