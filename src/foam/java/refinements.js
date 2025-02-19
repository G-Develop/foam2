/**
 * @license
 * Copyright 2017,2018 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */

foam.LIB({
  name: 'foam.java',
  flags: ['java'],
  methods: [
    {
      name: 'asJavaValue',
      code: foam.mmethod({
        String: function asJavaValue(s) {
          return '"' + s.
            replace(/\\/g, "\\\\").
            replace(/"/g, '\\"').
            replace(/\n/g, "\\n") + '"';
        },
        Boolean: function(b) {
          return b ? "true" : "false";
        },
        Number: function(n) {
          return '' + n + (n > Math.pow(2, 31) ? 'L' : '');
        },
        FObject: function(o) {
          return o.asJavaValue();
        },
        Undefined: function() {
          // TODO: This probably isn't strictly right, but we do it in
          // a number of places.
          return null;
        },
        Array: function(a, prop) {
          return "new " + (prop ? prop.javaType : 'Object[]') + " {" +
            a.map(foam.java.asJavaValue).join(',') +
            '}';
        },
        Null: function(n) { return "null"; },
        Object: function(o) {
          return `
new java.util.HashMap() {
  {
${Object.keys(o).map(function(k) {
  return `put(${foam.java.asJavaValue(k)}, ${foam.java.asJavaValue(o[k])});`
}).join('\n')}
  }
}
          `;
        },
        RegExp: function(o) {
          o = o.toString();
          o = o.slice(o.indexOf('/') + 1, o.lastIndexOf('/'))
          o = o.replace(/\\/g, '\\\\')
          return `java.util.regex.Pattern.compile("${o}")`
        },
      })
    },
    {
      name: 'toJavaType',
      code: function(type) {
        return foam.core.type.toType(type).toJavaType();
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'JavaType',
  extends: 'String',
  flags: ['java'],
  properties: [
    {
      name: 'flags',
      value: ['java']
    },
    {
      name: 'expression',
      expression: function(value) {
        // TODO: This is a large hack around the way SHADOW_MAP works.
        // What we really want is a way to specify a default
        // factory/expression but not to use it if the user sets a
        // default value.
        return function(type) {
          return value || foam.java.toJavaType(type);
        }
      }
    },
    {
      name: 'name',
      value: 'javaType'
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'ArgumentJavaRefinement',
  refines: 'foam.core.Argument',
  flags: ['java'],
  properties: [
    { class: 'foam.java.JavaType' }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'PropertyJavaRefinement',
  refines: 'foam.core.Property',
  flags: ['java'],
  properties: [
    {
      class: 'Boolean',
      name: 'generateJava',
      expression: function(flags) {
        return foam.util.flagFilter(['java'])(this);
      }
    },
    { class: 'foam.java.JavaType' },
    {
      class: 'String',
      name: 'javaJSONParser',
      value: 'foam.lib.json.AnyParser.instance()'
    },
    {
      class: 'String',
      name: 'javaQueryParser',
      expression: function(javaJSONParser) {
        return javaJSONParser;
      }
    },
    {
      class: 'String',
      name: 'javaCSVParser'
    },
    {
      class: 'String',
      name: 'javaInfoType'
    },
    {
      class: 'String',
      name: 'javaFactory'
    },
    {
      class: 'String',
      name: 'javaGetter'
    },
    {
      class: 'String',
      name: 'javaSetter'
    },
    {
      class: 'String',
      name: 'javaPreSet'
    },
    {
      class: 'String',
      name: 'javaPostSet'
    },
    {
      class: 'String',
      name: 'shortName'
    },
    {
      class: 'StringArray',
      name: 'aliases'
    },
    {
      class: 'String',
      name: 'javaCloneProperty',
      value: null
    },
    {
      class: 'String',
      name: 'javaDiffProperty',
      value: null
    },
    {
      class: 'String',
      name: 'javaCompare',
      value: 'return foam.util.SafetyUtil.compare(get_(o1), get_(o2));'
    },
    {
      class: 'String',
      name: 'javaComparePropertyToObject',
      value: 'return foam.util.SafetyUtil.compare(cast(key), get_(o));'
    },
    {
      class: 'String',
      name: 'javaComparePropertyToValue',
      value: 'return foam.util.SafetyUtil.compare(cast(key), cast(value));'
    },
    {
      class: 'String',
      name: 'javaAssertValue'
    },
    {
      class: 'String',
      name: 'javaValue',
      expression: function(value) {
        return foam.java.asJavaValue(value);
      }
    },
    {
      class: 'Boolean',
      name: 'includeInDigest',
      value: true
    },
    {
      class: 'Boolean',
      name: 'includeInSignature',
      value: true
    },
    {
      class: 'String',
      name: 'javaValidateObj',
      expression: function(validationPredicates) {
        return validationPredicates
          .map((vp) => {
            return `
              if ( ! ${foam.java.asJavaValue(vp.predicate)}.f(obj) ) {
                throw new IllegalStateException(${foam.java.asJavaValue(vp.errorString)});
              }
            `;
          })
          .join('');
      }
    },
    {
      class: 'String',
      name: 'javaToCSV',
      value: 'outputter.outputValue(obj != null ? get(obj) : null);'
    },
    {
      class: 'String',
      name: 'javaToCSVLabel',
      value: 'outputter.outputValue(getName());'
    },
  ],

  methods: [
    {
      name: 'asJavaValue',
      code: function() {
        return `${this.forClass_}.${foam.String.constantize(this.name)}`;
      }
    },
    function createJavaPropertyInfo_(cls) {
      return foam.java.PropertyInfo.create({
        sourceCls:               cls,
        propName:                this.name,
        propShortName:           this.shortName,
        propAliases:             this.aliases,
        propType:                this.javaType,
        propValue:               this.javaValue,
        propRequired:            this.required,
        cloneProperty:           this.javaCloneProperty,
        diffProperty:            this.javaDiffProperty,
        compare:                 this.javaCompare,
        comparePropertyToValue:  this.javaComparePropertyToValue,
        comparePropertyToObject: this.javaComparePropertyToObject,
        jsonParser:              this.javaJSONParser,
        queryParser:             this.javaQueryParser,
        csvParser:               this.javaCSVParser,
        extends:                 this.javaInfoType,
        networkTransient:        this.networkTransient,
        permissionRequired:      this.permissionRequired,
        storageTransient:        this.storageTransient,
        xmlAttribute:            this.xmlAttribute,
        xmlTextNode:             this.xmlTextNode,
        sqlType:                 this.sqlType,
        includeInDigest:         this.includeInDigest,
        includeInSignature:      this.includeInSignature,
        containsPII:             this.containsPII,
        containsDeletablePII:    this.containsDeletablePII,
        validateObj:             this.javaValidateObj,
        toCSV:                   this.javaToCSV,
        toCSVLabel:              this.javaToCSVLabel
      });
    },

    function generateSetter_() {
      // return user defined setter
      if ( this.javaSetter ) {
        return this.javaSetter;
      }

      var capitalized = foam.String.capitalize(this.name);
      var setter = `if ( this.__frozen__ ) throw new UnsupportedOperationException("Object is frozen.");\n`;

      // add value assertion
      if ( this.javaAssertValue ) {
        setter += this.javaAssertValue;
      }

      // add pre-set function
      if ( this.javaPreSet ) {
        setter += this.javaPreSet;
      };

      // set value
      setter += `${this.name}_ = val;\n`;
      setter += `${this.name}IsSet_ = true;\n`;

      // add post-set function
      if ( this.javaPostSet ) {
        setter += this.javaPostSet;
      }

      return setter;
    },

    function buildJavaClass(cls) {
      if ( ! this.generateJava ) return;

      // Use javaInfoType as an indicator that this property should be
      // generated to java code.

      // TODO: Evaluate if we still want this behaviour.  It might be
      // better to only respect the generateJava flag
      if ( ! this.javaInfoType ) return;

      var privateName = this.name + '_';
      var capitalized = foam.String.capitalize(this.name);
      var constantize = foam.String.constantize(this.name);
      var isSet       = this.name + 'IsSet_';
      var factoryName = capitalized + 'Factory_';

      cls.
        field({
          name: privateName,
          type: this.javaType,
          visibility: 'protected'
        }).
        field({
          name: isSet,
          type: 'boolean',
          visibility: 'private',
          initializer: 'false;'
        }).
        method({
          name: 'get' + capitalized,
          type: this.javaType,
          visibility: 'public',
          body: this.javaGetter || ('if ( ! ' + isSet + ' ) {\n' +
            ( this.javaFactory ?
                '  set' + capitalized + '(' + factoryName + '());\n' :
                ' return ' + this.javaValue + ';\n' ) +
            '}\n' +
            'return ' + privateName + ';')
        }).
        method({
          name: 'set' + capitalized,
          visibility: 'public',
          args: [
            {
              type: this.javaType,
              name: 'val'
            }
          ],
          type: 'void',
          body: this.generateSetter_()
        }).
        method({
          name: 'clear' + capitalized,
          visibility: 'public',
          type: 'void',
          body: `
if ( this.__frozen__ ) throw new UnsupportedOperationException("Object is frozen.");
${isSet} = false;
          `
        });

      if ( this.javaFactory ) {
        cls.method({
          name: factoryName,
          visibility: 'protected',
          type: this.javaType,
          body: this.javaFactory
        });
      }

      cls.field({
        name: constantize,
        visibility: 'public',
        static: true,
        type: 'foam.core.PropertyInfo',
        initializer: this.createJavaPropertyInfo_(cls)
      });

      var info = cls.getField('classInfo_');
      if ( info ) info.addAxiom(cls.name + '.' + constantize);
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ImplementsJavaRefinement',
  refines: 'foam.core.Implements',
  flags: ['java'],
  properties: [
    {
      name: 'java',
      class: 'Boolean',
      value: true
    }
  ],
  methods: [
    function buildJavaClass(cls) {
      if ( this.java ) cls.implements = cls.implements.concat(this.path);
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'InnerClassJavaRefinement',
  refines: 'foam.core.InnerClass',
  flags: ['java'],
  properties: [
    {
      class: 'Boolean',
      name: 'generateJava',
      expression: function(model) {
        return foam.util.flagFilter(['java'])(model);
      }
    }
  ],
  methods: [
    function buildJavaClass(cls) {
      if ( ! this.generateJava ) return;

      var innerClass = this.model.buildClass().buildJavaClass();
      innerClass.innerClass = true;
      innerClass.static = true;
      cls.classes.push(innerClass);

      return innerClass;
    }
  ]
});


foam.LIB({
  name: 'foam.core.FObject',
  flags: ['java'],
  methods: [
    function buildJavaClass(cls) {
      cls = cls || foam.java.Class.create();

      cls.name = this.model_.name;
      cls.package = this.model_.package;
      cls.abstract = this.model_.abstract;

      if ( this.model_.name !== 'AbstractFObject' ) {
        // if not AbstractFObject either extend AbstractFObject or use provided extends property
        cls.extends = this.model_.extends === 'FObject' ?
          'foam.core.AbstractFObject' : this.model_.extends;
      } else {
        // if AbstractFObject we implement FObject
        cls.implements = [ 'foam.core.FObject' ];
      }

      cls.fields.push(foam.java.ClassInfo.create({ id: this.id }));

      cls.method({
        name: 'getClassInfo',
        type: 'foam.core.ClassInfo',
        visibility: 'public',
        body: 'return classInfo_;'
      });

      cls.method({
        name: 'getOwnClassInfo',
        visibility: 'public',
        static: true,
        type: 'foam.core.ClassInfo',
        body: 'return classInfo_;'
      });

      var flagFilter = foam.util.flagFilter(['java']);
      var axioms = this.getOwnAxioms().filter(flagFilter);

      for ( var i = 0 ; i < axioms.length ; i++ ) {
        axioms[i].buildJavaClass && axioms[i].buildJavaClass(cls, this);
      }

      // TODO: instead of doing this here, we should walk all Axioms
      // and introuce a new buildJavaAncestorClass() method
      var flagFilter = foam.util.flagFilter(['java']);
      cls.allProperties = this.getAxiomsByClass(foam.core.Property)
        .filter(flagFilter)
        .filter(function(p) {
          return !! p.javaType && p.javaInfoType && p.generateJava;
        })
        .filter(flagFilter)
        .map(function(p) {
          return foam.java.Field.create({ name: p.name, type: p.javaType });
        });

      if ( this.model_.name !== 'AbstractFObject' ) {
        // if not AbstractFObject add beforeFreeze method
        cls.method({
          visibility: 'public',
          type: 'void',
          name: 'beforeFreeze',
          body: 'super.beforeFreeze();\n' + this.getAxiomsByClass(foam.core.Property).
            filter(flagFilter).
            filter(function(p) { return !! p.javaType && p.javaInfoType && p.generateJava; }).
            filter(function(p) { return p.javaFactory; }).
            map(function(p) {
              return `get${foam.String.capitalize(p.name)}();`
            }).join('\n')
        });
      }

      if ( this.hasOwnAxiom('id') ) {
        cls.implements = cls.implements.concat('foam.core.Identifiable');
        cls.method({
          visibility: 'public',
          type: 'Object',
          name: 'getPrimaryKey',
          body: 'return (Object)getId();'
        });
      }

      cls.method({
        name: 'hashCode',
        type: 'int',
        visibility: 'public',
        body: `return java.util.Objects.hash(${cls.allProperties.map(function(p) {
          return '(Object) ' + p.name + '_';
        }).join(',')});`
      });

      if ( cls.name ) {
        var props = cls.allProperties;

        // No-arg constructor
        cls.method({
          visibility: 'public',
          name: cls.name,
          type: '',
          body: ''
        });

        // Context-oriented constructor
        cls.method({
          visibility: 'public',
          name: cls.name,
          type: '',
          args: [{ type: 'foam.core.X', name: 'x' }],
          body: 'setX(x);'
        });

        if ( props.length ) {
          // All-property constructor
          cls.method({
            visibility: 'public',
            name: cls.name,
            type: '',
            args: props.map(function(f) {
              return { name: f.name, type: f.type };
            }),
            body: props.map(function(f) {
              return 'set' + foam.String.capitalize(f.name) + '(' + f.name + ')';
            }).join(';\n') + ';'
          });

          // Context oriented all-property constructor
          cls.method({
            visibility: 'public',
            name: cls.name,
            type: '',
            args: [{ name: 'x', type: 'foam.core.X' }]
              .concat(props.map(function(f) {
                return { name: f.name, type: f.type };
              })),
            body: ['setX(x)'].concat(props.map(function(f) {
              return 'set' + foam.String.capitalize(f.name) + '(' + f.name + ')';
            })).join(';\n') + ';'
          });
        }

        if ( ! cls.abstract ) {
          // Apply builder pattern if not abstract.
          foam.java.Builder.create({ properties: this.getAxiomsByClass(foam.core.Property)
            .filter(flagFilter)
            .filter(function(p) {
            return p.generateJava && p.javaInfoType;
          }) }).buildJavaClass(cls);
        }
      }

      return cls;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'AbstractMethodJavaRefinement',
  refines: 'foam.core.AbstractMethod',
  flags: ['java'],

  properties: [
    {
      class: 'String',
      name: 'javaCode',
      flags: ['java'],
    },
    { class: 'foam.java.JavaType' },
    {
      class: 'Boolean',
      name: 'final'
    },
    {
      class: 'Boolean',
      name: 'abstract',
      value: false
    },
    {
      class: 'StringArray',
      name: 'javaThrows'
    },
    {
      class: 'Boolean',
      name: 'javaSupport',
      expression: function(flags) {
        return foam.util.flagFilter(['java'])(this);
      }
    }
  ],

  methods: [
    function buildJavaClass(cls) {
      if ( ! this.javaSupport ) return;
      if ( ! this.javaCode && ! this.abstract ) return;

      cls.method({
        name: this.name,
        type: this.javaType || 'void',
        visibility: 'public',
        static: this.isStatic(),
        abstract: this.abstract,
        final: this.final,
        synchronized: this.synchronized,
        throws: this.javaThrows,
        args: this.args && this.args.map(function(a) {
          return {
            name: a.name,
            type: a.javaType
          };
        }),
        body: this.javaCode ? this.javaCode : ''
      });
    },
    function isStatic() {
      return false;
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'MessageJavaRefinement',
  refines: 'foam.i18n.MessageAxiom',
  flags: ['java'],

  methods: [
    function buildJavaClass(cls) {
      if ( this.flags && this.flags.length && this.flags.indexOf('java') == -1 ) {
        return;
      }
      cls.constant({
        name: this.name,
        type: 'String',
        value: foam.java.asJavaValue(this.message)
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'ConstantJavaRefinement',
  refines: 'foam.core.Constant',
  flags: ['java'],

  properties: [
    {
      name: 'javaValue',
      expression: function(value) {
        return foam.java.asJavaValue(value);
      }
    },
    { class: 'foam.java.JavaType' }
  ],

  methods: [
    function buildJavaClass(cls) {
      if ( this.flags && this.flags.length && this.flags.indexOf('java') == -1 ) {
        return;
      }

      if ( ! this.javaType ) {
        this.__context__.warn('Skipping constant ', this.name, ' with unknown type.');
        return;
      }

      cls.constant({
        name: this.name,
        type: this.javaType,
        value: this.javaValue,
        documentation: this.documentation
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'ActionJavaRefinement',
  refines: 'foam.core.Action',
  flags: ['java'],

  properties: [
    {
      class: 'String',
      name: 'javaCode'
    }
  ],

  methods: [
    function buildJavaClass(cls) {
      if ( ! this.javaCode ) return;

      cls.method({
        visibility: 'public',
        name: this.name,
        type: 'void',
        body: this.javaCode
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'MethodJavaRefinement',
  refines: 'foam.core.Method',
  flags: ['java'],
  properties: [
    {
      class: 'Boolean',
      name: 'abstract',
      value: false
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ProxiedMethodJavaRefinement',
  refines: 'foam.core.ProxiedMethod',
  flags: ['java'],

  properties: [
    {
      name: 'javaCode',
      getter: function() {
        // TODO: This could be an expression if the copyFrom in createChildMethod
        // didn't finalize its value
        if ( this.name == 'find' ) {
          console.log(this.name, 'returns', this.javaType);
        }
        var code = '';

        if ( this.javaType && this.javaType !== 'void' ) {
          code += 'return ';
        }

        code += 'get' + foam.String.capitalize(this.property) + '()';
        code += '.' + this.name + '(';

        for ( var i = 0 ; this.args && i < this.args.length ; i++ ) {
          code += this.args[i].name;
          if ( i != this.args.length - 1 ) code += ', ';
        }
        code += ');';

        return code;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ImportJavaRefinement',
  refines: 'foam.core.Import',
  flags: ['java'],

  properties: [
    { class: 'foam.java.JavaType' }
  ],

  methods: [
    function buildJavaClass(cls) {
      cls.method({
        type: this.javaType,
        name: 'get' + foam.String.capitalize(this.name),
        body: `return (${this.javaType})getX().get("${this.key}");`,
        visibility: 'protected'
      });
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FObjectJavaRefinement',
  refines: 'foam.core.FObject',
  flags: ['java'],
  methods: [
    {
      name: 'asJavaValue',
      code: function() {
        var self = this;
        var props = self.cls_.getAxiomsByClass(foam.core.Property)
          .filter(function(a) {
            return self.hasOwnProperty(a.name);
          })
          .map(function(p) {
            return `.set${foam.String.capitalize(p.name)}(${foam.java.asJavaValue(self[p.name], p)})`
          })
        return `
new ${self.cls_.id}.Builder(foam.core.EmptyX.instance())
  ${props.join('\n')}
  .build()
        `
      },
    },
    {
      name: 'toString',
      type: 'String',
      code: foam.core.FObject.prototype.toString
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'AbstractInterfaceJavaRefinement',
  refines: 'foam.core.AbstractInterface',
  flags: ['java'],
  axioms: [
    {
      installInClass: function(cls) {
        cls.buildJavaClass = function(cls) {
          cls = cls || foam.java.Interface.create();

          cls.name = this.model_.name;
          cls.package = this.model_.package;
          cls.implements = (this.implements || [])
            .concat(this.model_.javaExtends || []);

          var axioms = this.getAxioms().filter(foam.util.flagFilter(['java']));

          for ( var i = 0 ; i < axioms.length ; i++ ) {
            axioms[i].buildJavaClass && axioms[i].buildJavaClass(cls);
          }

          return cls;
        };
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'IntJavaRefinement',
  refines: 'foam.core.Int',
  flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.core.AbstractIntPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.IntParser()'],
    ['javaCSVParser', 'new foam.lib.json.IntParser()'],
    ['sqlType', 'INT']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var m = info.getMethod('cast');
      m.body = `return ( o instanceof Number ) ?
        ((Number)o).intValue() :
        ( o instanceof String ) ?
        Integer.valueOf((String) o) :
        (int)o;`;

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ByteJavaRefinement',
  refines: 'foam.core.Byte',
  flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.core.AbstractBytePropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.ByteParser()'],
    ['javaCSVParser', 'new foam.lib.json.ByteParser()'],
    ['sqlType', 'SMALLINT']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var m = info.getMethod('cast');
      m.body = `return ( o instanceof Number ) ?
        ((Number)o).byteValue() :
        ( o instanceof String ) ?
        Byte.valueOf((String) o) :
        (byte)o;`;

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ShortJavaRefinement',
  refines: 'foam.core.Short',
  flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.core.AbstractShortPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.ShortParser()'],
    ['javaCSVParser', 'new foam.lib.json.ShortParser()'],
    ['sqlType', 'SMALLINT']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var m = info.getMethod('cast');
      m.body = `return ( o instanceof Number ) ?
        ((Number)o).shortValue() :
        ( o instanceof String ) ?
        Short.valueOf((String) o) :
        (short)o;`;

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'LongJavaRefinement',
  refines: 'foam.core.Long',
  flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.core.AbstractLongPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.LongParser()'],
    ['javaCSVParser', 'new foam.lib.json.LongParser()'],
    ['sqlType', 'BIGINT'],
    ['javaCompare', 'return Long.compare(get_(o1), get_(o2));'],
    [ 'javaComparePropertyToValue', 'return Long.compare(cast(key), cast(value));' ],
    [ 'javaComparePropertyToObject', 'return Long.compare(cast(key), get_(o));' ]
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var m = info.getMethod('cast');
      m.body = `return ( o instanceof Number ) ?
        ((Number) o).longValue() :
        ( o instanceof String ) ?
        Long.valueOf((String) o) :
        (long) o;`;

      return info;
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'DoubleJavaRefinement',
  refines: 'foam.core.Double',
  flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.core.AbstractDoublePropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.DoubleParser()'],
    ['javaCSVParser', 'new foam.lib.json.DoubleParser()'],
    ['sqlType', 'DOUBLE PRECISION']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var m = info.getMethod('cast');
      m.body = `return ( o instanceof Number ) ?
        ((Number)o).doubleValue() :
        ( o instanceof String ) ?
        Double.parseDouble((String) o) :
        (double)o;`;

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FloatJavaRefinement',
  refines: 'foam.core.Float',
  flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.core.AbstractFloatPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.FloatParser()'],
    ['javaCSVParser', 'new foam.lib.json.FloatParser()'],
    ['sqlType', 'FLOAT']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var m = info.getMethod('cast');
      m.body = `return ( o instanceof Number ) ?
        ((Number)o).floatValue() :
        ( o instanceof String ) ?
        Float.parseFloat((String) o) :
        (float)o;`;

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'EnumJavaRefinement',
  refines: 'foam.core.Enum',
  flags: ['java'],

  properties: [
    { class: 'foam.java.JavaType' },
    ['javaInfoType', 'foam.core.AbstractEnumPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.IntParser()'],
    ['javaCSVParser', 'new foam.lib.json.IntParser()']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      info.method({
        name: 'getOrdinal',
        visibility: 'public',
        type: 'int',
        args: [
          {
            name: 'o',
            type: 'Object'
          }
        ],
        body: `return ((${this.of.id}) o).getOrdinal();`
      });

      info.method({
        name: 'forOrdinal',
        visibility: 'public',
        type: this.of.id,
        args: [
          {
            name: 'ordinal',
            type: 'int'
          }
        ],
        body: `return ${this.of.id}.forOrdinal(ordinal);`
      });

      info.method({
        name: 'toJSON',
        visibility: 'public',
        type: 'void',
        args: [
          {
            name: 'outputter',
            type: 'foam.lib.json.Outputter'
          },
          {
            name: 'value',
            type: 'Object'
          }
        ],
        body: `outputter.output(getOrdinal(value));`
      });

      var cast = info.getMethod('cast');
      cast.body = `if ( o instanceof Integer ) {
  return forOrdinal((int) o);
}
return (${this.of.id})o;`;

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'AbstractEnumJavaRefinement',
  refines: 'foam.core.AbstractEnum',
  flags: ['java'],

  axioms: [
    {
      installInClass: function(cls) {
        cls.buildJavaClass = function(cls) {
          cls = cls || foam.java.Enum.create();

          cls.name = this.name;
          cls.package = this.package;
          cls.extends = this.extends;
          cls.values = this.VALUES;

          cls.field({
            name: '__frozen__',
            visibility: 'protected',
            type: 'boolean',
            initializer: 'false'
          });

          var flagFilter = foam.util.flagFilter(['java']);
          var axioms = this.getAxioms().filter(flagFilter);
          for ( var i = 0 ; i < axioms.length ; i++ ) {
            axioms[i].buildJavaClass && axioms[i].buildJavaClass(cls);
          }

          var properties = this.getAxiomsByClass(foam.core.Property)
            .filter(flagFilter)
            .filter(p => p.generateJava && p.javaInfoType);

          cls.method({
            name: cls.name,
            args: properties.map(function(p) {
              return {
                name: p.name,
                type: p.javaType
              };
            }),
            body: properties.map(function(p) {
              return `set${foam.String.capitalize(p.name)}(${p.name});`;
            }).join('\n')
          });

          cls.declarations = this.VALUES.map(function(v) {
            return `${v.name}(${properties.map(p => foam.java.asJavaValue(v[p])).join(', ')})`;
          }).join(', ');

          cls.method({
            name: 'labels',
            type: 'String[]',
            visibility: 'public',
            static: true,
            body: `
return new String[] {
  ${this.VALUES.map(v => foam.java.asJavaValue(v.label)).join(', ')}
};
            `
          });

          cls.method({
            name: 'forOrdinal',
            type: cls.name,
            visibility: 'public',
            static: true,
            args: [ { name: 'ordinal', type: 'int' } ],
            body: `
switch (ordinal) {
${this.VALUES.map(v => `\tcase ${v.ordinal}: return ${cls.name}.${v.name};`).join('\n')}
}
return null;
            `
          });

          cls.method({
            name: 'forLabel',
            type: cls.name,
            visibility: 'public',
            static: true,
            args: [ { name: 'label', type: 'String' } ],
            body: `
switch (label) {
${this.VALUES.map(v => `\tcase "${v.label}": return ${cls.name}.${v.name};`).join('\n')}
}
return null;
            `
          });

          return cls;
        };
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'DateTimeJavaRefinement',
  refines: 'foam.core.DateTime',
  flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.core.AbstractDatePropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.DateParser()'],
    ['javaQueryParser', 'new foam.lib.query.DuringExpressionParser()'],
    ['javaCSVParser', 'new foam.lib.json.DateParser()'],
    ['sqlType', 'TIMESTAMP WITHOUT TIME ZONE']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var m = info.getMethod('cast');
      m.body = `
        try {
          if ( o instanceof Number ) {
            return new java.util.Date(((Number) o).longValue());
          } else if ( o instanceof String ) {
            return (java.util.Date) fromString((String) o);
          } else {
            return (java.util.Date) o;
          }
        } catch ( Throwable t ) {
          throw new RuntimeException(t);
        }`;

      return info;
  }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'DateJavaRefinement',
  refines: 'foam.core.Date',
  flags: ['java'],

   properties: [
       ['javaInfoType', 'foam.core.AbstractDatePropertyInfo'],
       ['javaJSONParser', 'new foam.lib.json.DateParser()'],
       ['javaQueryParser', 'new foam.lib.query.DuringExpressionParser()'],
       ['javaCSVParser', 'new foam.lib.json.DateParser()'],
       ['sqlType', 'DATE']
   ],

   methods: [
     function createJavaPropertyInfo_(cls) {
       var info = this.SUPER(cls);
       var m = info.getMethod('cast');
      m.body = `
        try {
          if ( o instanceof Number ) {
            return new java.util.Date(((Number) o).longValue());
          } else if ( o instanceof String ) {
            return (java.util.Date) fromString((String) o);
          } else {
            return (java.util.Date) o;
          }
        } catch ( Throwable t ) {
          throw new RuntimeException(t);
        }`;

       return info;
     }
   ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'MapJavaRefinement',
  refines: 'foam.core.Map',
  flags: ['java'],

  properties: [
    ['javaType', 'java.util.Map'],
    ['javaInfoType', 'foam.core.AbstractMapPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.MapParser()'],
    ['javaFactory', 'return new java.util.HashMap();']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      // override usage of SafetyUtil.compare with PropertyInfo compare
      var compare = info.getMethod('compare');
      compare.body = 'return super.compare(o1, o2);';

      var getValueClass = info.getMethod('getValueClass');
      getValueClass.body = 'return java.util.Map.class;';

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ListJavaRefinement',
  refines: 'foam.core.List',
  flags: ['java'],

  properties: [
    ['javaType', 'java.util.List'],
    ['javaInfoType', 'foam.core.AbstractListPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.ListParser()'],
    ['javaFactory', 'return new java.util.ArrayList();'],
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      // override usage of SafetyUtil.compare with PropertyInfo compare
      var compare = info.getMethod('compare');
      compare.body = 'return super.compare(o1, o2);';

      var getValueClass = info.getMethod('getValueClass');
      getValueClass.body = 'return java.util.List.class;';

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'StringJavaRefinement',
  refines: 'foam.core.String',
  flags: ['java'],

  properties: [
    ['javaInfoType', 'foam.core.AbstractStringPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.StringParser()'],
    ['javaQueryParser', 'new foam.lib.query.StringParser()'],
    ['javaCSVParser', 'new foam.lib.csv.CSVStringParser()'],
    {
      name: 'sqlType',
      expression: function(width) {
        return 'VARCHAR(' + width + ')';
      }
    }
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      // cast numbers to strings
      var cast = info.getMethod('cast');
      cast.body = `return ( o instanceof Number ) ?
        ((Number) o).toString() : (String) o;`;

      return info;
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'FObjectPropertyJavaRefinement',
  refines: 'foam.core.FObjectProperty',
  flags: ['java'],
  properties: [
    ['javaInfoType', 'foam.core.AbstractFObjectPropertyInfo'],
    {
      name: 'javaJSONParser',
      expression: function(of) {
        return 'new foam.lib.json.FObjectParser('
          + (of ? of.id + '.class' : '') + ')';
      }
    }
  ],
  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      if ( this.of &&
           this.of !== foam.core.FObject &&
           ! foam.core.InterfaceModel.isInstance(this.of.model_) ) {
        info.method({
          name: 'of',
          visibility: 'public',
          type: 'foam.core.ClassInfo',
          body: `return ${this.of.id}.getOwnClassInfo();`
        });
      }
      return info;
    }
  ],
});

foam.CLASS({
  package: 'foam.java',
  name: 'StringArrayJavaRefinement',
  refines: 'foam.core.StringArray',
  flags: ['java'],

  properties: [
    ['javaType', 'String[]'],
    ['javaInfoType', 'foam.core.AbstractArrayPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.StringArrayParser()'],
    ['javaFactory', 'return new String[0];'],
    {
      name: 'javaValue',
      expression: function(value) {
        if ( ! value ) {
          return null;
        } else {
          return 'new String[] {\"' + value.join('\",\"') + '\"}';
        }
      }
    },
    ['sqlType', 'TEXT']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var compare = info.getMethod('compare');
      compare.body = this.compareTemplate();

      var cast = info.getMethod('cast');
      cast.body = 'Object[] value = (Object[])o;\n'
                + this.javaType
                + ' ret = new String[value == null ? 0 : value.length];\n'
                + 'if ( value != null ) System.arraycopy(value, 0, ret, 0, value.length);\n'
                + 'return ret;';

      // TODO: figure out what this is used for
      info.method({
        name: 'of',
        visibility: 'public',
        type: 'String',
        body: 'return "String";'
      });

      var isDefaultValue = info.getMethod('isDefaultValue');
      isDefaultValue.body = 'return java.util.Arrays.equals(get_(o), null);';

      return info;
    }
  ],

  templates: [
    {
        name: 'compareTemplate',
        template: function() {
/* <%= this.javaType %> values1 = get_(o1);
<%= this.javaType %> values2 = get_(o2);
if ( values1 == null && values2 == null ) return 0;
if ( values2 == null ) return 1;
if ( values1 == null ) return -1;

if ( values1.length > values2.length ) return 1;
if ( values1.length < values2.length ) return -1;

int result;
for ( int i = 0 ; i < values1.length ; i++ ) {
  result = foam.util.SafetyUtil.compare(values1[i], values2[i]);
  if ( result != 0 ) return result;
}
return 0;*/
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ArrayJavaRefinement',
  refines: 'foam.core.Array',
  flags: ['java'],

  properties: [
    {
      name: 'javaType',
      expression: function(type) {
        return type ? foam.java.toJavaType(type) : 'Object[]'
      }
    },
    ['javaInfoType', 'foam.core.AbstractArrayPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.ArrayParser()']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var compare = info.getMethod('compare');
      compare.body = this.compareTemplate();

      // TODO: Change to ClassInfo return type once primitive support is added
      info.method({
        name: 'of',
        visibility: 'public',
        type: 'String',
        body: 'return "' + (this.of ? this.of.id ? this.of.id : this.of : null) + '";'
      });

      var isDefaultValue = info.getMethod('isDefaultValue');
      isDefaultValue.body = 'return java.util.Arrays.equals(get_(o), null);';

      return info;
    }
  ],

  templates: [
    {
      name: 'compareTemplate',
      template: function() {
/* <%= this.javaType %> values1 = get_(o1);
<%= this.javaType %> values2 = get_(o2);
if ( values1 == null && values2 == null ) return 0;
if ( values2 == null ) return 1;
if ( values1 == null ) return -1;

if ( values1.length > values2.length ) return 1;
if ( values1.length < values2.length ) return -1;

int result;
for ( int i = 0 ; i < values1.length ; i++ ) {
  result = ((Comparable)values1[i]).compareTo(values2[i]);
  if ( result != 0 ) return result;
}
return 0;*/
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'FObjectArrayJavaRefinement',
  refines: 'foam.core.FObjectArray',
  flags: ['java'],

  properties: [
    { class: 'foam.java.JavaType' },
    {
      name: 'javaFactory',
      expression: function(type) {
        return `return new ${foam.core.type.toType(type).type.toJavaType()}[0];`;
      }
    },
    {
      name: 'javaJSONParser',
      expression: function(of) {
        var id = of ? of.id ? of.id : of : null;
        return 'new foam.lib.json.FObjectArrayParser('
          + ( id ? id + '.class' : '') + ')';
      }
    },
    ['javaInfoType', 'foam.core.AbstractFObjectArrayPropertyInfo']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var compare = info.getMethod('compare');
      compare.body = this.compareTemplate();

      var cast = info.getMethod('cast');
      cast.body = 'Object[] value = (Object[])o;\n'
                + this.javaType + ' ret = new '
                + this.of + '[value == null ? 0 : value.length];\n'
                + 'if ( value != null ) System.arraycopy(value, 0, ret, 0, value.length);\n'
                + 'return ret;';
      // TODO: Change to ClassInfo return type once primitive support is added
      info.method({
        name: 'of',
        visibility: 'public',
        type: 'String',
        body: 'return "' + (this.of ? this.of.id ? this.of.id : this.of : null) + '";'
      });

      var isDefaultValue = info.getMethod('isDefaultValue');
      isDefaultValue.body = 'return java.util.Arrays.equals(get_(o), null);';

      return info;
    }
  ],

  templates: [
    {
      name: 'compareTemplate',
      template: function() {
/* <%= this.javaType %> values1 = get_(o1);
<%= this.javaType %> values2 = get_(o2);
if ( values1 == null && values2 == null ) return 0;
if ( values2 == null ) return 1;
if ( values1 == null ) return -1;

if ( values1.length > values2.length ) return 1;
if ( values1.length < values2.length ) return -1;

int result;
for ( int i = 0 ; i < values1.length ; i++ ) {
  result = ((Comparable)values1[i]).compareTo(values2[i]);
  if ( result != 0 ) return result;
}
return 0;*/
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.core',
  name: 'ArrayList',
  extends: 'foam.core.Array',
  flags: ['java'],
  properties: [
    ['javaType', 'ArrayList'],
    ['javaInfoType', 'foam.core.AbstractPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.ArrayParser()']
  ],

  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var compare = info.getMethod('compare');
      compare.body = this.compareTemplate();

      return info;
    }
  ],

  templates: [
    {
      name: 'compareTemplate',
      template: function() {/*
  <%= this.javaType %> values1 = get_(o1);
  <%= this.javaType %> values2 = get_(o2);

  if ( values1.size() > values2.size() ) return 1;
  if ( values1.size() < values2.size() ) return -1;

  int result;
  for ( int i = 0 ; i < values1.size() ; i++ ) {
    result = ((Comparable)values1.get(i)).compareTo(values2.get(i));
    if ( result != 0 ) return result;
  }
  return 0;*/}
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'BooleanJavaRefinement',
  refines: 'foam.core.Boolean',
  flags: ['java'],
  properties: [
    ['javaType', 'boolean'],
    ['javaInfoType', 'foam.core.AbstractBooleanPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.BooleanParser()'],
    ['javaCSVParser', 'new foam.lib.json.BooleanParser()'],
    ['sqlType', 'BOOLEAN']
  ],
  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);

      var m = info.getMethod('cast');
      m.body = 'return ((Boolean) o).booleanValue();';

      return info;
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ObjectJavaRefinement',
  refines: 'foam.core.Object',
  flags: ['java'],
  properties: [
    ['javaInfoType', 'foam.core.AbstractObjectPropertyInfo'],
    ['javaJSONParser', 'foam.lib.json.AnyParser.instance()'],
    ['javaQueryParser', 'foam.lib.query.AnyParser.instance()'],
    ['javaCSVParser', 'new foam.lib.csv.CSVStringParser()']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ClassJavaRefinement',
  refines: 'foam.core.Class',
  flags: ['java'],
  properties: [
    ['javaType', 'foam.core.ClassInfo'],
    ['javaInfoType', 'foam.core.AbstractClassPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.ClassReferenceParser()']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ProxyJavaRefinement',
  refines: 'foam.core.Proxy',
  flags: ['java'],
  properties: [
    {
      name: 'javaType',
      expression: function(of) {
        return of ? of : 'Object';
      }
    },
    ['javaInfoType', 'foam.core.AbstractFObjectPropertyInfo'],
    ['javaJSONParser', 'new foam.lib.json.FObjectParser()']
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ReferenceJavaRefinement',
  refines: 'foam.core.Reference',
  flags: [ 'java' ],

  properties: [
    {
      name: 'referencedProperty',
      documentation: `
        Used to ensure we use the right types for this
        value in statically typed languages.
      `,
      transient: true,
      expression: function(of) {
        return of.ID.cls_ == foam.core.IDAlias ? of.ID.targetProperty : of.ID;
      }
    },
    { name: 'type',            factory: function() { return this.referencedProperty.type; } },
    { name: 'javaType',        factory: function() { return this.referencedProperty.javaType; } },
    { name: 'javaJSONParser',  factory: function() { return this.referencedProperty.javaJSONParser; } },
    { name: 'javaQueryParser', factory: function() { return this.referencedProperty.javaQueryParser; } },
    { name: 'javaInfoType',    factory: function() { return this.referencedProperty.javaInfoType; } }
  ],

  methods: [
    function buildJavaClass(cls) {
      this.SUPER(cls);
      cls.method({
        name: `find${foam.String.capitalize(this.name)}`,
        visibility: 'public',
        type: this.of.id,
        args: [ { name: 'x', type: 'foam.core.X' } ],
        body: `return (${this.of.id})((foam.dao.DAO) x.get("${this.targetDAOKey}")).find_(x, (Object) get${foam.String.capitalize(this.name)}());`
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'MultitonJavaRefinement',
  refines: 'foam.pattern.Multiton',
  flags: ['java'],

  properties: [
    {
      name: 'javaName',
      value: 'Multiton',
    },
    {
      name: 'javaInfoName',
      expression: function(javaName) {
        return foam.String.constantize(this.javaName);
      },
    },
  ],

  methods: [
    function buildJavaClass(cls) {
      var info = cls.getField('classInfo_');
      if ( info ) info.addAxiom(cls.name + '.' + this.javaInfoName);

      cls.field({
        name: this.javaInfoName,
        visibility: 'public',
        static: true,
        type: 'foam.core.MultitonInfo',
        initializer: `
new foam.core.MultitonInfo("${this.javaName}", ${cls.name}.${foam.String.constantize(this.property)});
        `,
        order: 1,
      });
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'IDAliasJavaRefinement',
  refines: 'foam.core.IDAlias',
  flags: ['java'],
  properties: [
    {
      name: 'javaGetter',
      factory: function() {
        return `return get${foam.String.capitalize(this.propName)}();`;
      }
    },
    {
      name: 'javaSetter',
      factory: function() {
        return `set${foam.String.capitalize(this.targetProperty.name)}((${this.targetProperty.javaType})val);`;
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'MultiPartIDJavaRefinement',
  refines: 'foam.core.MultiPartID',
  flags: ['java'],

  properties: [
    ['javaJSONParser', 'new foam.lib.json.FObjectParser()'],
    {
      name: 'javaGetter',
      factory: function() {
        var str = `return new ${this.of.id}.Builder(getX()).
`;
        for ( var i = 0 ; i < this.propNames.length ; i++ ) {
          var name = foam.String.capitalize(this.propNames[i]);

          str += `  set${name}(get${name}()).
`;
        }

        return str += '  build();';
      }
    },
    {
      name: 'javaSetter',
      factory: function() {
        var str = '';

        for ( var i = 0 ; i < this.propNames.length ; i++ ) {
          var name = foam.String.capitalize(this.propNames[i]);

          str += `set${name}(val.get${name}());
`;
        }

        return str;
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ModelJavaRefinement',
  refines: 'foam.core.Model',
  flags: ['java'],

  properties: [
    {
      class: 'AxiomArray',
      of: 'foam.java.JavaImport',
      name: 'javaImports',
      adaptArrayElement: function(o) {
        return typeof o === 'string' ?
          foam.java.JavaImport.create({import: o}) :
          foam.java.JavaImport.create(o);
      }
    },
    {
      class: 'String',
      name: 'javaName',
      factory: function() { return this.id; }
    },
    {
      class: 'AxiomArray',
      of: 'foam.java.JavaImplements',
      name: 'javaImplements',
      adaptArrayElement: function(o) {
        return foam.String.isInstance(o) ?
          foam.java.JavaImplements.create({ name: o }) :
          foam.java.JavaImplements.create(o);
      }
    }
  ]
});


foam.CLASS({
  package: 'foam.java',
  name: 'ListenerJavaRefinement',
  refines: 'foam.core.Listener',
  flags: ['java'],
  properties: [
    {
      class: 'String',
      name: 'javaCode'
    }
  ],
  methods: [
    function buildJavaClass(cls) {
      if ( ! this.javaCode ) return;

      if ( ! this.isMerged && ! this.isFramed ) {
        cls.method({
          name: this.name,
          type: 'void',
          args: this.args && this.args.map(function(a) {
            return {
              name: a.name, type: a.javaType
            };
          }),
          body: this.javaCode
        });
        return;
      }

      cls.method({
        name: this.name + '_real_',
        type: 'void',
        visibility: 'protected',
        args: this.args && this.args.map(function(a) {
          return {
            name: a.name, type: a.javaType
          };
        }),
        body: this.javaCode
      });

      cls.method({
        name: this.name,
        type: 'void',
          args: this.args && this.args.map(function(a) {
            return {
              name: a.name, type: a.javaType
            };
          }),
        body: `${this.name + 'Listener_'}.fire(new Object[] { ${ this.args.map(function(a) {
          return a.name;
        }).join(', ') } });`
      });

      var listener = foam.java.Field.create({
        name: this.name + 'Listener_',
        visibility: 'protected',
        type: 'foam.core.MergedListener',
        initializer: foam.java.Class.create({
          anonymous: true,
          extends: 'foam.core.MergedListener',
          methods: [
            foam.java.Method.create({
              name: 'getDelay',
              type: 'int',
              visibility: 'public',
              body: `return ${this.isFramed ? 16 : this.mergeDelay};`
            }),
            foam.java.Method.create({
              name: 'go',
              type: 'void',
              visibility: 'public',
              args: [foam.java.Argument.create({ type: 'Object[]', name: 'args' })],
              body: `${this.name + '_real_'}(${ this.args && this.args.map(function(a, i) {
                return '(' + a.javaType + ')args[' + i + ']';
              }).join(', ') });`
            })
          ]
        })
      });

      cls.fields.push(listener);
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'RequiresJavaRefinement',
  refines: 'foam.core.Requires',
  flags: ['java'],
  properties: [
    {
      name: 'javaPath',
      expression: function(path) {
        return path;
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'FunctionJavaRefinement',
  refines: 'foam.core.Function',
  flags: ['java'],
  properties: [
    ['javaType', 'java.util.function.Function']
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'PromisedMethodRefinement',
  refines: 'foam.core.PromisedMethod',
  flags: ['java'],
  properties: [
    {
      name: 'javaCode',
      getter: function() {
        return `
try {
  synchronized ( getDelegate() ) {
    if ( ! getDelegate().isPropertySet("${this.property}") ) getDelegate().wait();
  }
} catch (Exception e) {
  throw new RuntimeException(e);
}
${this.javaType != 'void' ? 'return ' : ''}getDelegate()
    .${this.name}(${this.args.map(a => a.name).join(', ')});
        `;
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'PromisedRefinement',
  refines: 'foam.core.Promised',
  flags: ['java'],
  properties: [
    ['javaInfoType', 'foam.core.AbstractFObjectPropertyInfo'],
    {
      name: 'javaType',
      expression: function(of) { return of; }
    },
    {
      name: 'javaPostSet',
      expression: function(name, stateName) {
        return `
set${foam.String.capitalize(stateName)}(val);
try {
  synchronized ( this ) {
    this.notifyAll();
  }
} catch (Exception e) {
  throw new RuntimeException(e);
}
        `;
      }
    }
  ]
});

foam.CLASS({
  package: 'foam.java',
  name: 'DAOPropertyJavaRefinement',
  refines: 'foam.dao.DAOProperty',
  flags: ['java'],
  methods: [
    function createJavaPropertyInfo_(cls) {
      var info = this.SUPER(cls);
      var compare = info.getMethod('compare');
      compare.body = 'return 0;';
      return info;
    }
  ]
});