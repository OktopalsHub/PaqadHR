import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { CreateAddressDto } from "./create-address.dto";

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
