import { Public } from '@/common/decorators/jwt-auth.decorator';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @ApiOperation({
    summary: 'Sign up',
  })
  @Public()
  @Post('signup')
  signup(@Body() signupDto: SignupDto) {
    return this.usersService.create(signupDto);
  }

  @ApiOperation({
    summary: 'Login',
  })
  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
