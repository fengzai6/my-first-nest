import {
  AuthException,
  AuthExceptionCode,
} from '@/common/exceptions/auth.exception';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { Role } from '../roles/entities';
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
    const isExist = await this.usersService.exist(
      registerDto.username,
      registerDto.email,
    );

    if (isExist) {
      throw new AuthException(AuthExceptionCode.USER_ALREADY_EXISTS);
    }

    const hashedPassword = await hash(registerDto.password, {
      timeCost: 5,
    });

    let roles: Role[];

    if (registerDto.roles && registerDto.roles.length > 0) {
      roles = await this.rolesService.findByCodes(registerDto.roles);
    }

    const newUser = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
      roles,
    });

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

    return {
      user,
      accessToken: this.jwtService.sign({
        id: user.id,
        username: user.username,
      }),
    };
  }
}
