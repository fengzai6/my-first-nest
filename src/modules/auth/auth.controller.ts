import { Public } from '@/common/decorators/jwt-auth.decorator';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @ApiOperation({
    summary: 'Register',
  })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.usersService.create(registerDto);
  }

  @Public()
  @ApiOperation({
    summary: 'Login',
  })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
