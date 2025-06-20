import {
  AuthException,
  AuthExceptionCode,
} from '@/common/exceptions/auth.exception';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly rolesService: RolesService,
  ) {}

  async signup(signupDto: SignupDto) {
    const user = await this.usersService.find(signupDto.username);

    if (user) {
      throw new AuthException(AuthExceptionCode.USER_ALREADY_EXISTS);
    }

    const hashedPassword = await hash(signupDto.password, {
      timeCost: 5,
    });

    const roles = await this.rolesService.findByCodes(signupDto.roles);

    const newUser = await this.usersService.create({
      ...signupDto,
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
