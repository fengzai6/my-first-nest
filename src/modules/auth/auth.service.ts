import {
  AuthException,
  AuthExceptionCode,
} from '@/common/exceptions/auth.exception';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { RolesService } from '../roles/roles.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly rolesService: RolesService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.find(registerDto.username);

    if (user) {
      throw new AuthException(AuthExceptionCode.USER_ALREADY_EXISTS);
    }

    const hashedPassword = await hash(registerDto.password, {
      timeCost: 5,
    });

    const roles = await this.rolesService.findByCodes(registerDto.roles);

    const newUser = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      roles,
    });

    delete newUser.password;

    return newUser;
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.find(loginDto.username);

    if (!user) {
      throw new AuthException(AuthExceptionCode.USER_NOT_FOUND);
    }

    const isPasswordValid = await verify(user.password, loginDto.password);

    if (!isPasswordValid) {
      throw new AuthException(AuthExceptionCode.INVALID_CREDENTIALS);
    }

    delete user.password;

    return {
      user,
      accessToken: this.jwtService.sign({
        id: user.id,
        username: user.username,
      }),
    };
  }
}
