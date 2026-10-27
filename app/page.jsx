import {add} from '../src/add.mjs';
import {Prisma} from '@prisma/client';
export default function Page(){return <main>Fixture: {add(2,3)} / Prisma {Prisma.prismaVersion.client}</main>;}
