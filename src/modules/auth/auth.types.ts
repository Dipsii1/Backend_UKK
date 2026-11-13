export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
};

export type RegisterResult = {
  user: {
    public_id: string;
    email: string;
    full_name: string;
  };
  message: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    public_id: string;
    email: string;
    full_name: string;
    role: string;
  };
};

export type ProfileResult = {
  public_id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  gender: string | null;
  birth_date: Date | null;
  avatar: string | null;
  address: string | null;
  province_id: bigint | null;
  city_id: bigint | null;
};

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export type ResetPasswordResult = {
  message: string;
};