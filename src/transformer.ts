import type { DMMF as PrismaDMMF } from '@prisma/generator-helper';
import path from 'path';
import { writeFileSafely } from './utils/writeFileSafely';

export default class Transformer {
  name?: string;
  modelNameFolder: string;
  fields?: PrismaDMMF.SchemaArg[];
  schemaImports?: Set<string>;
  modelOperations?: PrismaDMMF.ModelMapping[];
  enumTypes?: PrismaDMMF.SchemaEnum[];
  static enumNames: Array<string> = [];
  static generatedSchemaFiles: Array<string> = [];
  static generatedSchemaObjectFiles: Array<string> = [];
  static generatedSchemaEnumFiles: Array<string> = [];
  private static outputPath?: string;
  constructor({
    name,
    modelNameFolder,
    fields,
    modelOperations,
    enumTypes,
  }: {
    name?: string | undefined;
    modelNameFolder?: string | undefined;
    fields?: PrismaDMMF.SchemaArg[] | undefined;
    schemaImports?: Set<string>;
    modelOperations?: PrismaDMMF.ModelMapping[];
    enumTypes?: PrismaDMMF.SchemaEnum[];
  }) {
    this.name = name ?? '';
    this.modelNameFolder = modelNameFolder ?? '';
    this.fields = fields ?? [];
    this.modelOperations = modelOperations ?? [];
    this.schemaImports = new Set();
    this.enumTypes = enumTypes;
  }

  static setOutputPath(outPath: string) {
    this.outputPath = outPath;
  }

  static getOutputPath() {
    return this.outputPath;
  }

  addSchemaImport(name: string) {
    this.schemaImports?.add(name);
  }

  getPathDepth(filename: string, name: string, subfolder: string, enumList: string[]) {
    const suffixList = [
      'UncheckedCreateInput',
      'UncheckedCreateNestedManyWithout',
      'UncheckedCreateWithout',
      'UncheckedUpdateInput',
      'UncheckedUpdateManyInput',
      'UncheckedUpdateManyWithout',
      'UncheckedUpdateWithout',
      'UpdateOneWithout',
      'UpdateInput',
      'UpdateManyMutationInput',
      'UpdateManyWithout',
      'UpdateManyWithWhereWithout',
      'UpdateWithout',
      'UpdateWithWhereUniqueWithout',
      'UpdateOneRequiredWithout',
      'UpsertWithWhereUniqueWithout',
      'UpsertWithout',
      'AvgOrderByAggregateInput',
      'CountOrderByAggregateInput',
      'CreateInput',
      'CreateNestedManyWithout',
      'CreateOrConnectWithout',
      'CreateWithout',
      'CreateMany',
      'CreateNestedOneWithout',
      'ListRelationFilter',
      'MaxOrderByAggregateInput',
      'MinOrderByAggregateInput',
      'OrderByRelationAggregateInput',
      'OrderByWithAggregationInput',
      'OrderByWithRelationInput',
      'ScalarWhereInput',
      'ScalarWhereWithAggregatesInput',
      'SumOrderByAggregateInput',
      'WhereInput',
      'WhereUniqueInput',
      'RelationFilter'
    ]
    const folderName = filename.split('/')

    if (name.includes('JsonNullValueFilter')) {
      return '../../enums/'
    }

    let foundFolderName = ''
    for (const item of suffixList) {
      const pos = name.indexOf(item)

      if (pos !== -1) {
        foundFolderName = name.substring(0, pos)
        break
      }
    }
    if (folderName[2] === foundFolderName) {
      return './'
    }
    if (foundFolderName === '' && folderName[2] === 'Other') {
      return './'
    }

    if (foundFolderName !== '') {
      return `../${foundFolderName}/`
    }

    for (const e of enumList) {
      if (e.includes(name)) {
        return '../../enums/'
      }
    }

    if (name.includes('CompoundUniqueInput')) {
      return './'
    }

    return '../Other/'
  }

  getAllSchemaImports(filename: string) {
    return [...(this.schemaImports ?? [])]
      .map((name) =>
        Transformer.enumNames.includes(name)
          ? `import { ${name}Schema } from '${this.getPathDepth(filename, name, 'enums', Transformer.generatedSchemaEnumFiles)}${name}.schema'`
          : `import { ${name}SchemaObject } from '${this.getPathDepth(filename, name, '', Transformer.generatedSchemaEnumFiles)}${name}.schema'`,
      )
      .join(';\r\n');
  }

  getPrismaStringLine(
    field: PrismaDMMF.SchemaArg,
    inputType: PrismaDMMF.SchemaArgInputType,
    inputsLength: number,
  ) {
    if (inputsLength === 1) {
      if (inputType.isList) {
        if (inputType.type === this.name) {
          return `  ${field.name
            }: Joi.array().items(${`Joi.link('#${inputType.type}')`})`;
        } else {
          return `  ${field.name}: ${Transformer.enumNames.includes(inputType.type as string)
            ? `${`${inputType.type}Schema`}`
            : `Joi.array().items(Joi.object().keys(${`${inputType.type}SchemaObject`}))`
            }`;
        }
      } else {
        if (inputType.type === this.name) {
          return `  ${field.name}: ${`Joi.link('#${inputType.type}')`}`;
        } else {
          return `  ${field.name}: ${Transformer.enumNames.includes(inputType.type as string)
            ? `${`${inputType.type}Schema`}`
            : `Joi.object().keys(${`${inputType.type}SchemaObject`})`
            }`;
        }
      }
    }

    if (inputsLength > 1) {
      if (inputType.isList) {
        if (inputType.type === this.name) {
          return `Joi.array().items(${`Joi.link('#${inputType.type}')`})`;
        } else {
          return `${Transformer.enumNames.includes(inputType.type as string)
            ? `${`${inputType.type}Schema`}`
            : `Joi.array().items(Joi.object().keys(${`${inputType.type}SchemaObject`}))`
            }`;
        }
      } else {
        if (inputType.type === this.name) {
          return `${`Joi.link('#${inputType.type}')`}`;
        } else {
          return `${Transformer.enumNames.includes(inputType.type as string)
            ? `${`${inputType.type}Schema`}`
            : `Joi.object().keys(${`${inputType.type}SchemaObject`})`
            }`;
        }
      }
    }
    return '';
  }

  getSchemaObjectLine(field: PrismaDMMF.SchemaArg) {
    let lines: any = field.inputTypes;

    const inputsLength = field.inputTypes.length;
    if (inputsLength === 0) return lines;

    if (inputsLength === 1) {
      lines = lines.map((inputType: PrismaDMMF.SchemaArgInputType) => {
        if (inputType.type === 'String') {
          return [
            `  ${field.name}: ${inputType.isList
              ? 'Joi.array().items(Joi.string())'
              : 'Joi.string()'
            }`,
            field,
          ];
        } else if (inputType.type === 'Int' || inputType.type === 'Float') {
          return [
            `  ${field.name}: ${inputType.isList
              ? 'Joi.array().items(Joi.number())'
              : 'Joi.number()'
            }`,
            field,
          ];
        } else if (inputType.type === 'Boolean') {
          return [
            `  ${field.name}: ${inputType.isList
              ? 'Joi.array().items(Joi.boolean())'
              : 'Joi.boolean()'
            }`,
            field,
          ];
        } else if (inputType.type === 'DateTime') {
          return [
            `  ${field.name}: ${inputType.isList ? 'Joi.array().items(Joi.date())' : 'Joi.date()'
            }`,
            field,
          ];
        } else {
          if (inputType.namespace === 'prisma') {
            if (inputType.type !== this.name) {
              this.addSchemaImport(inputType.type as string);
            }

            return [
              this.getPrismaStringLine(field, inputType, inputsLength),
              field,
              true,
            ];
          }
        }
        return [];
      });
    } else {
      const alternatives = lines.reduce(
        (result: Array<string>, inputType: PrismaDMMF.SchemaArgInputType) => {
          if (inputType.type === 'String') {
            result.push(
              inputType.isList
                ? 'Joi.array().items(Joi.string())'
                : 'Joi.string()',
            );
          } else if (inputType.type === 'Int' || inputType.type === 'Float') {
            result.push(
              inputType.isList
                ? 'Joi.array().items(Joi.number())'
                : 'Joi.number()',
            );
          } else if (inputType.type === 'Boolean') {
            result.push(
              inputType.isList
                ? 'Joi.array().items(Joi.boolean())'
                : 'Joi.boolean()',
            );
          } else {
            if (inputType.namespace === 'prisma') {
              if (inputType.type !== this.name) {
                this.addSchemaImport(inputType.type as string);
              }
              result.push(
                this.getPrismaStringLine(field, inputType, inputsLength),
              );
            } else if (inputType.type === 'Json') {
              result.push(
                inputType.isList ? 'Joi.array().items(Joi.any())' : 'Joi.any()',
              );
            }
          }
          return result;
        },
        [],
      );

      if (alternatives.length > 0) {
        lines = [
          [
            `  ${field.name}: Joi.alternatives().try(${alternatives.join(
              ',\r\n',
            )})`,
            field,
            true,
          ],
        ];
      } else {
        return [[]];
      }
    }

    return lines.filter(Boolean);
  }

  getFieldValidators(
    joiStringWithMainType: string,
    field: PrismaDMMF.SchemaArg,
  ) {
    let joiStringWithAllValidators = joiStringWithMainType;
    const { isRequired, isNullable } = field;
    if (isRequired) {
      joiStringWithAllValidators += '.required()';
    }
    if (isNullable) {
      joiStringWithAllValidators += '.allow(null)';
    }
    return joiStringWithAllValidators;
  }

  wrapWithObject({
    joiStringFields,
    isArray = true,
    forData = false,
  }: {
    joiStringFields: string;
    isArray?: boolean;
    forData?: boolean;
  }) {
    let wrapped = '{';
    wrapped += '\n';
    wrapped += isArray
      ? '  ' + (joiStringFields as unknown as Array<string>).join(',\r\n')
      : '  ' + joiStringFields;
    wrapped += '\n';
    wrapped += forData ? '  ' + '}' : '}';
    return wrapped;
  }

  getImportJoi() {
    let joiImportStatement = "import Joi from 'joi';";
    joiImportStatement += '\n';
    return joiImportStatement;
  }

  getImportsForSchemaObjects(filename: string) {
    let imports = this.getImportJoi();
    imports += this.getAllSchemaImports(filename);
    imports += '\n\n';
    return imports;
  }

  getImportsForSchemas(additionalImports: Array<string>) {
    let imports = this.getImportJoi();
    imports += [...additionalImports].join(';\r\n');
    imports += '\n\n';
    return imports;
  }

  addExportSchemaObject(schema: string) {
    return `export const ${this.name}SchemaObject = ${schema}`;
  }

  addExportSchema(schema: string, name: string) {
    return `export const ${name}Schema = ${schema}`;
  }

  getImportNoCheck() {
    let imports = '// @ts-nocheck';
    imports += '\n';
    return imports;
  }

  getFinalForm(joiStringFields: string, filename: string) {
    return `${this.getImportNoCheck()}${this.getImportsForSchemaObjects(filename)}${this.addExportSchemaObject(
      this.wrapWithObject({ joiStringFields }),
    )}`;
  }
  async printSchemaObjects() {
    const joiStringFields = (this.fields ?? [])
      .map((field) => {
        const value = this.getSchemaObjectLine(field);
        return value;
      })
      .flatMap((item) => item)
      .filter((item) => item && item.length > 0)
      .map((item) => {
        const [joiStringWithMainType, field, skipValidators] = item;
        const value = skipValidators
          ? joiStringWithMainType
          : this.getFieldValidators(joiStringWithMainType, field);
        return value;
      });

    await writeFileSafely(
      path.join(
        Transformer.outputPath,
        `schemas/objects${this.modelNameFolder}${this.name}.schema.ts`,
      ),
      this.getFinalForm(joiStringFields as unknown as string, `schemas/objects${this.modelNameFolder}${this.name}.schema.ts`),
    );

    Transformer.generatedSchemaObjectFiles.push(`.${this.modelNameFolder}${this.name}.schema`);
  }

  async printModelSchemas() {
    for (const model of this.modelOperations ?? []) {
      const {
        model: modelName,
        findUnique,
        findFirst,
        findMany,
        // @ts-ignore
        createOne,
        // @ts-ignore
        deleteOne,
        // @ts-ignore
        updateOne,
        deleteMany,
        updateMany,
        // @ts-ignore
        upsertOne,
        aggregate,
        groupBy,
      } = model;

      if (findUnique) {
        const imports = [
          `import { ${modelName}WhereUniqueInputSchemaObject } from '../objects'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/findUnique/${findUnique}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ where: Joi.object().keys(${modelName}WhereUniqueInputSchemaObject) }).required()`,
            `${modelName}FindUnique`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./findUnique/${findUnique}.schema`);
      }

      if (findFirst) {
        const imports = [
          `import { ${modelName}WhereInputSchemaObject, ${modelName}OrderByWithRelationInputSchemaObject, ${modelName}WhereUniqueInputSchemaObject } from '../objects'`,
          `import { ${modelName}ScalarFieldEnumSchema } from '../enums'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/findFirst/${findFirst}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ where: Joi.object().keys(${modelName}WhereInputSchemaObject), orderBy: Joi.object().keys(${modelName}OrderByWithRelationInputSchemaObject), cursor: Joi.object().keys(${modelName}WhereUniqueInputSchemaObject), take: Joi.number(), skip: Joi.number(), distinct: Joi.array().items(${modelName}ScalarFieldEnumSchema) }).required()`,
            `${modelName}FindFirst`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./findFirst/${findFirst}.schema`);
      }

      if (findMany) {
        const imports = [
          `import { ${modelName}WhereInputSchemaObject, ${modelName}OrderByWithRelationInputSchemaObject, ${modelName}WhereUniqueInputSchemaObject } from '../objects'`,
          `import { ${modelName}ScalarFieldEnumSchema } from '../enums'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/findMany/${findMany}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ where: Joi.object().keys(${modelName}WhereInputSchemaObject), orderBy: Joi.object().keys(${modelName}OrderByWithRelationInputSchemaObject), cursor: Joi.object().keys(${modelName}WhereUniqueInputSchemaObject), take: Joi.number(), skip: Joi.number(), distinct: Joi.array().items(${modelName}ScalarFieldEnumSchema)  }).required()`,
            `${modelName}FindMany`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./findMany/${findMany}.schema`);
      }

      if (createOne) {
        const imports = [
          `import { ${modelName}CreateInputSchemaObject } from '../objects'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/createOne/${createOne}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ data: Joi.object().keys(${modelName}CreateInputSchemaObject)  }).required()`,
            `${modelName}Create`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./createOne/${createOne}.schema`);
      }

      if (deleteOne) {
        const imports = [
          `import { ${modelName}WhereUniqueInputSchemaObject } from '../objects'`,
        ];
        await writeFileSafely(
          path.join(
            Transformer.outputPath,
            `schemas/deleteOne/${deleteOne}.schema.ts`,
          ),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ where: Joi.object().keys(${modelName}WhereUniqueInputSchemaObject)  }).required()`,
            `${modelName}DeleteOne`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./deleteOne/${deleteOne}.schema`);
      }

      if (deleteMany) {
        const imports = [
          `import { ${modelName}WhereInputSchemaObject } from '../objects'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/deleteMany/${deleteMany}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ where: Joi.object().keys(${modelName}WhereInputSchemaObject)  }).required()`,
            `${modelName}DeleteMany`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./deleteMany/${deleteMany}.schema`);
      }

      if (updateOne) {
        const imports = [
          `import { ${modelName}UpdateInputSchemaObject, ${modelName}WhereUniqueInputSchemaObject } from '../objects'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/updateOne/${updateOne}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ data: Joi.object().keys(${modelName}UpdateInputSchemaObject), where: Joi.object().keys(${modelName}WhereUniqueInputSchemaObject)  }).required()`,
            `${modelName}UpdateOne`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./updateOne/${updateOne}.schema`);
      }

      if (updateMany) {
        const imports = [
          `import { ${modelName}UpdateManyMutationInputSchemaObject, ${modelName}WhereInputSchemaObject } from '../objects'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/updateMany/${updateMany}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ data: Joi.object().keys(${modelName}UpdateManyMutationInputSchemaObject), where: Joi.object().keys(${modelName}WhereInputSchemaObject)  }).required()`,
            `${modelName}UpdateMany`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./updateMany/${updateMany}.schema`);
      }

      if (upsertOne) {
        const imports = [
          `import { ${modelName}WhereUniqueInputSchemaObject, ${modelName}CreateInputSchemaObject, ${modelName}UpdateInputSchemaObject } from '../objects'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/upsertOne/${upsertOne}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ where: Joi.object().keys(${modelName}WhereUniqueInputSchemaObject), data: Joi.object().keys(${modelName}CreateInputSchemaObject), update: Joi.object().keys(${modelName}UpdateInputSchemaObject)  }).required()`,
            `${modelName}Upsert`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./upsertOne/${upsertOne}.schema`);
      }

      if (aggregate) {
        const imports = [
          `import { ${modelName}WhereInputSchemaObject, ${modelName}OrderByWithRelationInputSchemaObject, ${modelName}WhereUniqueInputSchemaObject } from '../objects'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/aggregate/${aggregate}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ where: Joi.object().keys(${modelName}WhereInputSchemaObject), orderBy: Joi.object().keys(${modelName}OrderByWithRelationInputSchemaObject), cursor: Joi.object().keys(${modelName}WhereUniqueInputSchemaObject), take: Joi.number(), skip: Joi.number()  }).required()`,
            `${modelName}Aggregate`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./aggregate/${aggregate}.schema`);
      }

      if (groupBy) {
        const imports = [
          `import { ${modelName}WhereInputSchemaObject, ${modelName}OrderByWithAggregationInputSchemaObject, ${modelName}ScalarWhereWithAggregatesInputSchemaObject } from '../objects'`,
          `import { ${modelName}ScalarFieldEnumSchema } from '../enums'`,
        ];
        await writeFileSafely(
          path.join(Transformer.outputPath, `schemas/groupBy/${groupBy}.schema.ts`),
          `${this.getImportsForSchemas(imports)}${this.addExportSchema(
            `Joi.object().keys({ where: Joi.object().keys(${modelName}WhereInputSchemaObject), orderBy: Joi.object().keys(${modelName}OrderByWithAggregationInputSchemaObject), having: Joi.object().keys(${modelName}ScalarWhereWithAggregatesInputSchemaObject), take: Joi.number(), skip: Joi.number(), by: Joi.array().items(${modelName}ScalarFieldEnumSchema).required()  }).required()`,
            `${modelName}GroupBy`,
          )}`,
        );
        Transformer.generatedSchemaFiles.push(`./groupBy/${groupBy}.schema`);
      }
    }
  }

  async printIndex(type: 'SCHEMAS' | 'SCHEMA_OBJECTS' | 'SCHEMA_ENUMS') {
    const filesPaths =
      type === 'SCHEMAS'
        ? Transformer.generatedSchemaFiles
        : type === 'SCHEMA_ENUMS'
          ? Transformer.generatedSchemaEnumFiles
          : Transformer.generatedSchemaObjectFiles;
    const exports = filesPaths.map(
      (schemaPath) => `export * from '${schemaPath}';`,
    );

    const outputPath = path.join(
      Transformer.outputPath,
      type === 'SCHEMAS'
        ? `schemas/index.ts`
        : type === 'SCHEMA_ENUMS'
          ? `schemas/enums/index.ts`
          : `schemas/objects/index.ts`,
    );
    await writeFileSafely(outputPath, `${exports.join('\r\n')}`);
  }

  async printEnumSchemas() {
    for (const enumType of this.enumTypes ?? []) {
      const { name, values } = enumType;

      await writeFileSafely(
        path.join(Transformer.outputPath, `schemas/enums/${name}.schema.ts`),
        `${this.getImportJoi()}\n${this.addExportSchema(
          `Joi.string().valid(...${JSON.stringify(values)})`,
          `${name}`,
        )}`,
      );
      Transformer.generatedSchemaEnumFiles.push(`./${name}.schema`);
    }
  }
}
