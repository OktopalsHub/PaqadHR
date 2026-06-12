import { Repository } from "typeorm";
import { Tenant } from "../../modules/v1/tenants/entities/tenant.entity";

export interface ITenantRepository extends Repository<Tenant> {
    findBySlug(slug: string): Promise<Tenant | null>;
}
