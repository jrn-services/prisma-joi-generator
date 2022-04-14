import { DMMF as PrismaDMMF } from '@prisma/client/runtime';
import { parseEnvValue } from '@prisma/sdk';
import { EnvValue, GeneratorOptions } from '@prisma/generator-helper';
import removeDir from './utils/removeDir';
import { promises as fs } from 'fs';
import Transformer from './transformer';

export async function generate(options: GeneratorOptions) {
  const outputDir = parseEnvValue(options.generator.output as EnvValue);
  await fs.mkdir(outputDir, { recursive: true });
  await removeDir(outputDir, true);

  const prismaClientProvider = options.otherGenerators.find(
    (it) => parseEnvValue(it.provider) === 'prisma-client-js',
  );
  const prismaClientPath = parseEnvValue(
    prismaClientProvider?.output as EnvValue,
  );
  const prismaClientDmmf = (await import(prismaClientPath))
    .dmmf as PrismaDMMF.Document;

  Transformer.setOutputPath(outputDir);

  for (
    let i = 0;
    i < prismaClientDmmf.schema.inputObjectTypes.prisma.length;
    i += 1
  ) {
    const fields = prismaClientDmmf.schema.inputObjectTypes.prisma[i]?.fields;
    const name = prismaClientDmmf.schema.inputObjectTypes.prisma[i]?.name;
    const obj = new Transformer({ name, fields });
    await obj.printSchemaObjects();
  }

  const obj = new Transformer({
    modelOperations: prismaClientDmmf.mappings.modelOperations,
  });
  await obj.printModelSchemas();
}
