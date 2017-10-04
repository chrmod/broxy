const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const elmModuleName = 'TsElmInterfaces';
const elmMsgPrefix = 'Sub';
const elmTypeScriptMsgType = 'TypescriptMsg';


function generateElmType(node) {
  switch (node.kind) {
    case ts.SyntaxKind.BooleanKeyword:
      return 'Bool';
    case ts.SyntaxKind.StringKeyword:
      return 'String';
    case ts.SyntaxKind.NumberKeyword:
      return 'Float';
    case ts.SyntaxKind.TupleType: {
      const elementTypes = node.elementTypes.map(generateElmType);
      return `(${elementTypes.join(', ')})`;
    }
    case ts.SyntaxKind.ArrayType:
      return `(Array ${generateElmType(node.elementType)})`;
    case ts.SyntaxKind.JSDocNullableType:
      return `(Maybe ${generateElmType(node.type)})`;
    default:
      return 'JEncode.Value';
  }
}


function generateElmDecoder(node) {
  switch (node.kind) {
    case ts.SyntaxKind.BooleanKeyword:
      return 'JDecode.bool';
    case ts.SyntaxKind.StringKeyword:
      return 'JDecode.string';
    case ts.SyntaxKind.NumberKeyword:
      return 'JDecode.float';
    case ts.SyntaxKind.TupleType: {
      // TODO
      return 'decodeTuple_is_not_implemented';
    }
    case ts.SyntaxKind.ArrayType:
      return `(JDecode.array ${generateElmDecoder(node.elementType)})`;
    case ts.SyntaxKind.JSDocNullableType:
      return `(JDecode.nullable ${generateElmDecoder(node.type)})`;
    default:
      return `decode${generateElmType(node)}_is_not_implemented`;
  }
}


function collectInterfaceDeclarations(source) {
  const declarations = [];
  const nodes = [source];

  while (nodes.length > 0) {
    const node = nodes.splice(0, 1)[0];
    if (node.kind === ts.SyntaxKind.InterfaceDeclaration) {
      declarations.push(node);
    } else {
      ts.forEachChild(node, (child) => {
        nodes.push(child);
      });
    }
  }

  return declarations;
}


function generateElmHeader() {
  return [
    `port module ${elmModuleName} exposing (..)`,
  ];
}


function generateElmImports() {
  return [`
import Json.Encode as JEncode
import Json.Decode as JDecode
import Json.Decode.Extra exposing ((|:))
import Array exposing (Array)
  `];
}


function generateElmTypes(types) {
  return types.map(({ name, members }) => `
type alias ${name} =
  {${members.map(({ field, type }) => ` ${field} : ${generateElmType(type)}`).join('\n  ,')}
  }
`);
}


function generateElmMsgType(types) {
  return [`
type ${elmTypeScriptMsgType}
  = MessagingError String
  | ${types.map(({ name }) => `${elmMsgPrefix}${name} ${name}`).join('\n  | ')}
`];
}


function generateElmDecoders(types) {
  return types.map(({ name, members }) => `
decode${name} : JEncode.Value -> ${elmTypeScriptMsgType}
decode${name} x =
  let
    decoder =
      JDecode.succeed ${name} ${members.map(({ field, type }) => `\n        |: JDecode.field "${field}" ${generateElmDecoder(type)}`).join('')}
  in
    case JDecode.decodeValue decoder x of
        Ok result ->
            ${elmMsgPrefix}${name} result
        Err err ->
            MessagingError err
`);
}


function generateElmSubscriptions(types) {
  return [`
tsSubscriptions : Sub ${elmTypeScriptMsgType}
tsSubscriptions =
    Sub.batch
        [ ${types.map(({ name }) => `receive${name} decode${name}`).join('\n        , ')}
        ]
`];
}


function generateElmPorts(types) {
  return [`
${types.map(({ name }) => `port receive${name} : (JEncode.Value -> msg) -> Sub msg`).join('\n')}
`];
}


function generateElmModule(source) {
  // Extract interfaces and convert them to Elm types
  const types = collectInterfaceDeclarations(source).map(declaration => ({
    name: declaration.name.escapedText,
    members: declaration.members.map(member => ({
      field: member.name.escapedText,
      type: member.type,
    })),
  }));

  // Generate Elm module content
  return [
    ...generateElmHeader(types),
    ...generateElmImports(types),
    ...generateElmTypes(types),
    ...generateElmMsgType(types),
    ...generateElmDecoders(types),
    ...generateElmSubscriptions(types),
    ...generateElmPorts(types),
  ].join('\n');
}


function convert(inputFile, outputFile, callback) {
  fs.readFile(inputFile, 'utf8', (readErr, data) => {
    if (readErr) {
      callback(readErr);
    } else {
      try {
        const parsedSource = ts.createSourceFile(
          inputFile,
          data,
          ts.ScriptTarget.ES6,
          true, /* setParentNodes */
        );
        const elmDeclaration = generateElmModule(parsedSource);
        fs.writeFile(outputFile, elmDeclaration, 'utf8', callback);
      } catch (ex) {
        callback(ex);
      }
    }
  });
}


function main() {
  const argv = process.argv;
  if (argv.length > 2) {
    const inputFile = argv[2];
    const outputFile = path.join(argv[3], `${elmModuleName}.elm`);

    if (!inputFile.endsWith('.ts')) {
      console.error('First argument should be a Typescript source file');
      console.error('> Given:', inputFile);
    } else {
      console.log('Generate Elm type from typescript interfaces...');
      console.log('> Input file:', inputFile);
      console.log('> Output file:', outputFile);

      convert(inputFile, outputFile, (err) => {
        if (err) {
          console.error('Error while generating Elm types', err);
        } else {
          console.log('Generation successful!');
        }
      });
    }
  }
}


main();
