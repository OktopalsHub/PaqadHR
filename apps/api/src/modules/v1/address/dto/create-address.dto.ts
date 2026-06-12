import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
export class CreateAddressDto {
  @IsString()
  @ApiProperty({
    description: 'country',
  })
  @IsNotEmpty()
  country: string;
  @IsString()
  @ApiProperty({
    description: 'street',
  })
  @IsOptional()
  street: string;
  @IsString()
  @ApiProperty({
    description: 'city',
  })
  @IsNotEmpty()
  city: string;
  @IsString()
  @ApiProperty({
    description: 'state',
  })
  @IsNotEmpty()
  state: string;
  @IsString()
  @ApiProperty({
    description: 'postal code',
    example: 'ABC123',
  })
  @IsOptional()
  postalCode: string;
}
