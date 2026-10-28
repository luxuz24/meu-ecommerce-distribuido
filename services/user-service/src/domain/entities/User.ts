export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface UserProps {
  id: string;
  name: string;
  email: string;
  password: string;
  role?: UserRole | string;
  createdAt: Date;
}

export class User {
  public readonly id: string;
  public readonly name: string;
  public readonly email: string;
  public readonly password: string;
  public readonly role: UserRole;
  public readonly createdAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.password = props.password;
    this.role = props.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
    this.createdAt = props.createdAt;
  }
}
