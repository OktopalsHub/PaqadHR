import { Injectable } from '@nestjs/common';
import { DepartmentCrudService } from './department-crud.service';
import { DepartmentMembersService } from './department-members.service';

@Injectable()
export class DepartmentsService {
  getDepartments: DepartmentCrudService['getDepartments'];
  getDepartment: DepartmentCrudService['getDepartment'];
  createDepartment: DepartmentCrudService['createDepartment'];
  updateDepartment: DepartmentCrudService['updateDepartment'];
  deleteDepartment: DepartmentCrudService['deleteDepartment'];
  addMemberToDepartment: DepartmentMembersService['addMemberToDepartment'];
  removeMemberFromDepartment: DepartmentMembersService['removeMemberFromDepartment'];
  getDepartmentMembers: DepartmentMembersService['getDepartmentMembers'];

  constructor(
    private readonly crud: DepartmentCrudService,
    private readonly members: DepartmentMembersService,
  ) {
    this.getDepartments = this.crud.getDepartments.bind(this.crud);
    this.getDepartment = this.crud.getDepartment.bind(this.crud);
    this.createDepartment = this.crud.createDepartment.bind(this.crud);
    this.updateDepartment = this.crud.updateDepartment.bind(this.crud);
    this.deleteDepartment = this.crud.deleteDepartment.bind(this.crud);
    this.addMemberToDepartment = this.members.addMemberToDepartment.bind(this.members);
    this.removeMemberFromDepartment = this.members.removeMemberFromDepartment.bind(this.members);
    this.getDepartmentMembers = this.members.getDepartmentMembers.bind(this.members);
  }
}
