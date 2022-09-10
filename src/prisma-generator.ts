import { parseEnvValue, getDMMF } from '@prisma/internals';
import { EnvValue, GeneratorOptions } from '@prisma/generator-helper';
import removeDir from './utils/removeDir';
import { promises as fs } from 'fs';
import Transformer from './transformer';
import matchFolderName from './utils/matchFolderName';

export async function generate(options: GeneratorOptions) {
  const outputDir = parseEnvValue(options.generator.output as EnvValue);
  await fs.mkdir(outputDir, { recursive: true });
  await removeDir(outputDir, true);

  const prismaClientProvider = options.otherGenerators.find(
    (it) => parseEnvValue(it.provider) === 'prisma-client-js',
  );

  const prismaClientDmmf = await getDMMF({
    datamodel: options.datamodel,
    previewFeatures: prismaClientProvider?.previewFeatures,
  });

  const models = prismaClientDmmf.datamodel.models.map(model => model.name)

  Transformer.setOutputPath(outputDir);

  const enumTypes = [
    ...prismaClientDmmf.schema.enumTypes.prisma,
    ...(prismaClientDmmf.schema.enumTypes.model ?? []),
  ];
  const enumNames = enumTypes.map((enumItem) => enumItem.name);

  Transformer.enumNames = enumNames ?? [];
  const enumsObj = new Transformer({
    enumTypes,
  });

  await enumsObj.printEnumSchemas();

  for (
    let i = 0;
    i < prismaClientDmmf.schema.inputObjectTypes.prisma.length;
    i += 1
  ) {
    const fields = prismaClientDmmf.schema.inputObjectTypes.prisma[i]?.fields;
    const name = prismaClientDmmf.schema.inputObjectTypes.prisma[i]?.name;
    const modelNameFolder = matchFolderName(models, name)

    const obj = new Transformer({ name, fields, modelNameFolder });
    await obj.printSchemaObjects();
  }

  const obj = new Transformer({
    modelOperations: prismaClientDmmf.mappings.modelOperations,
  });
  await obj.printModelSchemas();

  await obj.printIndex('SCHEMAS');
  await obj.printIndex('SCHEMA_OBJECTS');
  await obj.printIndex('SCHEMA_ENUMS');
}
