export interface UserProps {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
}

export class User {
  public readonly id: string;
  public readonly name: string;
  public readonly email: string;
  public readonly password: string;
  public readonly createdAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
    this.password = props.password;
    this.createdAt = props.createdAt;
  }
}
