import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import type { EmployeeDetailForm } from "../../../hooks/use-employee-detail-form";

interface PersonalInfoTabProps {
  form: EmployeeDetailForm;
}

export function PersonalInfoTab({ form }: PersonalInfoTabProps) {
  const { employee, handleInputChange, handleNestedInputChange } = form;

  return (
    <TabsContent value="personal">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Employee's personal and contact details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                value={employee.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={employee.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={employee.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={employee.dateOfBirth}
                onChange={(e) =>
                  handleInputChange("dateOfBirth", e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Input
                id="gender"
                value={employee.personalInfo.gender}
                onChange={(e) =>
                  handleNestedInputChange(
                    "personalInfo",
                    "gender",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marital-status">Marital Status</Label>
              <Input
                id="marital-status"
                value={employee.personalInfo.maritalStatus}
                onChange={(e) =>
                  handleNestedInputChange(
                    "personalInfo",
                    "maritalStatus",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={employee.personalInfo.nationality}
                onChange={(e) =>
                  handleNestedInputChange(
                    "personalInfo",
                    "nationality",
                    e.target.value,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blood-group">Blood Group</Label>
              <Input
                id="blood-group"
                value={employee.personalInfo.bloodGroup}
                onChange={(e) =>
                  handleNestedInputChange(
                    "personalInfo",
                    "bloodGroup",
                    e.target.value,
                  )
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Address Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={employee.address.street}
                  onChange={(e) =>
                    handleNestedInputChange("address", "street", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={employee.address.city}
                  onChange={(e) =>
                    handleNestedInputChange("address", "city", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={employee.address.state}
                  onChange={(e) =>
                    handleNestedInputChange("address", "state", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">Zip Code</Label>
                <Input
                  id="zip"
                  value={employee.address.zipCode}
                  onChange={(e) =>
                    handleNestedInputChange(
                      "address",
                      "zipCode",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={employee.address.country}
                  onChange={(e) =>
                    handleNestedInputChange(
                      "address",
                      "country",
                      e.target.value,
                    )
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
